import AWS from 'aws-sdk';
import config from 'config';
import moment from 'moment-timezone';
import logger from '../utils/logger.js';
import { getRateKey } from './utils.js';
import cron from 'node-cron';

class Rates {
  constructor() {
    AWS.config.update({ region: config.get('aws.region') });

    this.dynamo = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

    ['usd', 'eur'].forEach(async (c, i) => {
      const everything = (await this.getEverything('MB', c)).filter(
        (r) => r.max_ask > 0
      );
      let next = 0;
      let jobs = [];

      await new Promise((resolve) =>
        jobs.push(
          cron.schedule('* * * * *', () => {
            const {
              date,
              currency,
              point_date: pointDate,
              type,
              ask,
              bid,
              trend_ask: trendAsk,
              trend_bid: trendBid,
              max_ask: maxAsk,
              min_bid: minBid
            } = everything[next++];
            this.setDate({
              date: date.format('YYYY-MM-DD'),
              currency,
              pointDate,
              type,
              ask,
              bid,
              trendAsk,
              trendBid,
              maxAsk,
              minBid
            });
            console.log(`Normalized data for ${date.format('YYYY-MM-DD')}`);

            if (next === everything.length) {
              console.log(`Finished normalizing ${c}`);
              jobs[i].stop();
              resolve();
            }
          })
        )
      );
    });
  }

  async getSince(type, currency, startDate) {
    var params = {
      TableName: 'RBRate',
      KeyConditionExpression: '#currencyType = :key and #date > :startDate',
      ExpressionAttributeNames: {
        '#currencyType': 'currencyType',
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':key': getRateKey(currency, type),
        ':startDate': startDate.format('YYYY-MM-DD')
      },
      ReturnConsumedCapacity: 'TOTAL'
    };

    try {
      const result = await this.dynamo.query(params).promise();

      logger.info(
        `Rates table query consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );

      return result.Items.map(this.normalize).reverse();
    } catch (e) {
      logger.error(e);
    }
  }

  async getEarliestDate(type, currency) {
    var params = {
      TableName: 'RBRate',
      KeyConditionExpression: '#currencyType = :key',
      ExpressionAttributeNames: {
        '#currencyType': 'currencyType'
      },
      ExpressionAttributeValues: {
        ':key': getRateKey(currency, type)
      },
      Limit: 1,
      ReturnConsumedCapacity: 'TOTAL'
    };

    try {
      const result = await this.dynamo.query(params).promise();

      logger.info(
        `Rates table query consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );

      return result.Items.map(this.normalize)[0].date;
    } catch (e) {
      logger.error(e);
    }
  }

  async getDate(type, currency, date) {
    var params = {
      TableName: 'RBRate',
      KeyConditionExpression: '#currencyType = :key and #date = :startDate',
      ExpressionAttributeNames: {
        '#currencyType': 'currencyType',
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':key': getRateKey(currency, type),
        ':startDate': date.format('YYYY-MM-DD')
      },
      ReturnConsumedCapacity: 'TOTAL'
    };

    try {
      const result = await this.dynamo.query(params).promise();

      logger.info(
        `Rates table query consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );

      return result.Items.map(this.normalize)[0] || null;
    } catch (e) {
      logger.error(e);
    }
  }

  async getEverything(type, currency) {
    var params = {
      TableName: 'RBRate',
      KeyConditionExpression: '#currencyType = :key',
      ExpressionAttributeNames: {
        '#currencyType': 'currencyType'
      },
      ExpressionAttributeValues: {
        ':key': getRateKey(currency, type)
      },
      ReturnConsumedCapacity: 'TOTAL'
    };

    try {
      const result = await this.dynamo.query(params).promise();

      logger.info(
        `Rates table query consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );

      return result.Items.map(this.normalize);
    } catch (e) {
      logger.error(e);
    }
  }

  async setDate(data) {
    const { currency, type } = data;

    try {
      const result = await this.dynamo
        .put({
          TableName: 'RBRate',
          Item: {
            currencyType: getRateKey(currency, type),
            ...data
          },
          ReturnConsumedCapacity: 'TOTAL'
        })
        .promise();

      logger.info(
        `Rates table write consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );
    } catch (e) {
      logger.error(e);
    }
  }

  normalize(rate) {
    const { date, pointDate, currencyType, ...rest } = rate;

    return {
      date: new moment(date),
      pointDate: new moment(pointDate),
      ...rest
    };
  }
}

const rates = new Rates();

export default rates;
