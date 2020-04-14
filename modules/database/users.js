import AWS from 'aws-sdk';
import config from 'config';
import User from './user.js';

class Users {
  constructor() {
    AWS.config.update({ region: config.get('aws.region') });

    this.dynamo = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
  }

  async getUser(chatId) {
    const data = await this.dynamo
      .get({
        TableName: 'User',
        Key: { chatId }
      })
      .promise();

    return data.Item;
  }

  addTestUser() {
    return this.dynamo
      .put({
        TableName: 'User',
        Item: new User(-1, 'Test', 'Test', { agreed: true, frequency: 3 })
      })
      .promise();
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
        Key: { chatId }
      })
      .promise();
  }
}

const users = new Users();

export default users;
