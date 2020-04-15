import mysql from 'mysql2/promise';
import config from 'config';
import moment from 'moment';

class Rates {
  constructor() {
    mysql
      .createConnection({
        host: config.get('mysql.host'),
        user: config.get('mysql.user'),
        database: config.get('mysql.db'),
        password: config.get('mysql.password'),
        timezone: config.get('default_timezone')
      })
      .then((connection) => (this.connection = connection));

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

  async addRate({
    date,
    type,
    currency,
    pointDate,
    ask,
    bid,
    trendAsk,
    trendBid,
    maxAsk,
    minBid
  }) {
    try {
      let updateResult = await this.connection.execute(
        `update RATES
        set point_date = '${pointDate.format('YYYY-MM-DD HH:mm:ss')}',
            ask = ${ask},
            bid = ${bid},
            trend_ask = ${trendAsk},
            trend_bid = ${trendBid},
            max_ask = ${maxAsk},
            min_bid = ${minBid}
        where date = '${date.format('YYYY-MM-DD')}' 
            and type = '${type}' 
            and currency = '${currency}'`
      );

      if (updateResult[0].affectedRows === 0) {
        updateResult = await this.connection.execute(
          `insert into RATES (date, type, currency, point_date, ask, bid, trend_ask, trend_bid, max_ask, min_bid)
            values ('${date.format('YYYY-MM-DD')}', '${type}', '${currency}', 
                '${pointDate.format('YYYY-MM-DD HH:mm:ss')}',
                ${ask}, ${bid}, ${trendAsk}, ${trendBid}, ${maxAsk}, ${minBid}
            )`
        );

        return updateResult;
      }
    } catch (err) {
      console.error('Error while adding rate.');
      console.error(err);
    }
  }

  async getRate(date, currency, type) {
    try {
      const data = await this.connection.execute(
        `select * from RATES 
        where date = '${date.format('YYYY-MM-DD')}' 
            and type = '${type}' 
            and currency = '${currency}'`
      );

      if (data[0].length) {
        return data[0][0];
      } else {
        return null;
      }
    } catch (err) {
      console.error('Error while fetching rate:.');
      console.error(err);
    }
  }

  removeRate({ date, currency, type }) {
    try {
      return this.connection.execute(
        `delete from RATES 
        where date = '${date.format('YYYY-MM-DD')}' 
        and type = '${type}' 
        and currency = '${currency}'`
      );
    } catch (err) {
      console.error('Error while deleting rate.');
      console.error(err);
    }
  }

  async getEarliestDate() {
    try {
      const data = await this.connection.execute(
        'select min(date) as earliest from RATES'
      );

      return new moment(data[0][0].earliest);
    } catch (err) {
      console.error('Error while fetching rate:.');
      console.error(err);
    }
  }
}

const rates = new Rates();

export default rates;
