import mysql from 'mysql';
import config from 'config';

class Rates {
  constructor() {
    this.connection = mysql.createConnection({
      host: config.get('mysql.host'),
      user: config.get('mysql.user'),
      database: config.get('mysql.db'),
      password: config.get('mysql.password'),
      timezone: config.get('default_timezone')
    });

    this.connection.connect(function (err) {
      if (err) {
        return console.error('Failed to connect to MySQL: ' + err.message);
      } else {
        console.log('Connected to MySQL');
      }
    });

    process.on('SIGINT', () => {
      console.log('Closing connection to MySQL');
      this.connection.end(function (err) {
        if (err) {
          console.log('Failed to close connection to MySQL: ' + err.message);
          return;
        }
        console.log('Closed connection to MySQL');
      });
    });
  }

  addRate(rate) {}

  async getRate(date, currency, type) {
    const data = await this.dynamo
      .get({
        TableName: 'Rate'
      })
      .promise();

    return data.Item;
  }

  removeRate(date, currency, type) {
    return this.dynamo
      .delete({
        TableName: 'Rate'
      })
      .promise();
  }
}

const rates = new Rates();

export default rates;
