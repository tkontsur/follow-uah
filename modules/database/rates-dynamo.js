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
