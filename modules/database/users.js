import AWS from 'aws-sdk';
import config from 'config';
import User from './user.js';

class Users {
  constructor() {
    AWS.config.update({ region: config.get('aws.region') });

    this.dynamo = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
  }

  async getUser(chatId) {
    try {
      const data = await this.dynamo
        .get({
          TableName: 'User',
          Key: {
            subscription: 'all',
            chatId
          }
        })
        .promise();

      return data.Item;
    } catch (e) {
      console.error(e);
    }
  }

  async getSubscribedChats(subscription = 'all') {
    var params = {
      TableName: 'User',
      KeyConditionExpression: 'subscription = :subscription',
      ExpressionAttributeValues: {
        ':subscription': subscription
      },
      ProjectionExpression: 'chatId',
      ReturnConsumedCapacity: 'TOTAL'
    };

    try {
      const result = await this.dynamo.query(params).promise();

      console.log(
        `Users teble scan consumed ${result.ConsumedCapacity.CapacityUnits} units.`
      );

      return result.Items.map((i) => i.chatId);
    } catch (e) {
      console.error(e);
    }
  }

  addUser(user) {
    return this.dynamo
      .put({
        TableName: 'User',
        Item: user
      })
      .promise();
  }

  removeUser(chatId) {
    return this.dynamo
      .delete({
        TableName: 'User',
        Key: {
          subscription: 'all',
          chatId
        }
      })
      .promise();
  }
}

const users = new Users();

export default users;
