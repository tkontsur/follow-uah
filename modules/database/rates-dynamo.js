import AWS from 'aws-sdk';
import config from 'config';
import moment from 'moment-timezone';
import logger from '../utils/logger.js';
import { getRateKey } from './utils.js';

class Rates {
  constructor() {
    AWS.config.update({ region: config.get('aws.region') });

    this.dynamo = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
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
        ':startDate': startDate.format('YYYY-MM-DD')
      },
      ReturnConsumedCapacity: 'TOTAL'
    };

    try {
      const result = await this.dynamo.query(params).promise();

      logger.info(
        `Rates table query consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );

      return result.Items.map(this.normalize)[0];
    } catch (e) {
      logger.error(e);
    }
  }

  async setDate(data) {
    const { currency, type } = data;
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
