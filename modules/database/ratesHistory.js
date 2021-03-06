import AWS from 'aws-sdk';
import config from 'config';
import logger from '../utils/logger.js';
import moment from 'moment-timezone';
import { getRateKey } from './utils.js';

class RatesHistory {
  constructor() {
    AWS.config.update({ region: config.get('aws.region') });

    this.dynamo = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

    this.state = {};
  }

  getAllTriggered() {
    return this.state;
  }

  getLatestRateSync(type, currency) {
    return this.state[getRateKey(currency, type)];
  }

  setLocal(data) {
    const key = getRateKey(data.currency, data.type);

    this.state[key] = {
      currencyType: key,
      ...data
    };
  }

  async getLatestRate(type, currency) {
    if (this.state[getRateKey(currency, type)]) {
      return this.state[getRateKey(currency, type)];
    }

    var params = {
      TableName: 'RBUpdateHistory',
      KeyConditionExpression: 'currencyType = :key',
      ExpressionAttributeValues: {
        ':key': getRateKey(currency, type)
      },
      Limit: 1,
      ScanIndexForward: false,
      ReturnConsumedCapacity: 'TOTAL'
    };

    try {
      const result = await this.dynamo.query(params).promise();

      logger.info(
        `UpdateHistory table query consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );

      if (result.Items.length < 1) {
        return null;
      }

      const update = result.Items.map(this.normalize)[0];
      this.state[getRateKey(currency, type)] = update;
      return update;
    } catch (e) {
      logger.error(e);
    }
  }

  record(data) {
    const { currency, type, date } = data;
    this.state[getRateKey(currency, type)] = data;

    return this.dynamo
      .put({
        TableName: 'RBUpdateHistory',
        Item: {
          ...data,
          currencyType: getRateKey(currency, type),
          date: date.format('YYYY-MM-DD')
        },
        ReturnConsumedCapacity: 'TOTAL'
      })
      .promise()
      .then((result) => {
        logger.info(
          `UpdateHistory table write consumed ${result.ConsumedCapacity.CapacityUnits} units.`
        );
        return result;
      });
  }

  normalize(rate) {
    const { date, currencyType, ...rest } = rate;

    return {
      date: new moment(date),
      ...rest
    };
  }
}

const ratesHistory = new RatesHistory();

export default ratesHistory;
