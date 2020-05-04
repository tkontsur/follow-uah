import AWS from 'aws-sdk';
import config from 'config';
import logger from '../utils/logger.js';

class RatesHistory {
  constructor() {
    AWS.config.update({ region: config.get('aws.region') });

    this.dynamo = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
  }

  async getLatestRate(type, currency) {
    var params = {
      TableName: 'RBUpdateHistory',
      KeyConditionExpression: 'currencyType = :key',
      ExpressionAttributeValues: {
        ':key': this.getKey(currency, type)
      },
      Limit: 1,
      ReturnConsumedCapacity: 'TOTAL'
    };

    try {
      const result = await this.dynamo.query(params).promise();

      logger.info(
        `UpdateHistory table query consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );

      return result.Items;
    } catch (e) {
      logger.error(e);
    }
  }

  record(data) {
    return this.dynamo
      .put({
        TableName: 'RBUpdateHistory',
        Item: {
          currencyType: this.getKey(data.currency, data.type),
          ...data
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

  getKey(currency, type) {
    return `${currency}-${type}`;
  }
}

const ratesHistory = new RatesHistory();

export default ratesHistory;
