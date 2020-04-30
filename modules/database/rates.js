import mysql from 'mysql2/promise.js';
import config from 'config';
import moment from 'moment-timezone';
import logger from '../utils/logger.js';

class Rates {
  constructor() {
    /*process.on('SIGINT', () => {
      logger.info('Closing connection to MySQL');
      this.connection.end(function (err) {
        if (err) {
          logger.info('Failed to close connection to MySQL: ' + err.message);
          return;
        }
        logger.info('Closed connection to MySQL');
      });
    });*/
  }

  async connect() {
    const connection = await mysql.createConnection({
      host: config.get('mysql.host'),
      user: config.get('mysql.user'),
      database: config.get('mysql.db'),
      password: config.get('mysql.password'),
      timezone: moment().tz(config.get('default_timezone')).format('Z')
    });

    this.connection = connection;
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
    logger.info(`Saving ${date}: ${currency} ${ask} (${trendAsk}) ${bid} (${trendBid})`);
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
      logger.error('Error while adding rate.');
      logger.error(err);
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
        return this.normalize(data[0][0]);
      } else {
        return null;
      }
    } catch (err) {
      logger.error('Error while fetching rate:.');
      logger.error(err);
    }
  }

  async getRates(date, type) {
    try {
      const data = await this.connection.execute(
        `select * from RATES 
        where date = '${date.format('YYYY-MM-DD')}' 
            and type = '${type}'`
      );

      if (data[0].length) {
        return data[0].map(this.normalize);
      } else {
        return null;
      }
    } catch (err) {
      logger.error('Error while fetching rate:.');
      logger.error(err);
    }
  }

  async getLatestDates(count) {
    try {
      const data = await this.connection.execute(
        `select distinct * from RATES 
        order by date desc, type, currency desc
        limit ${count * 2}`
      );

      if (data[0].length) {
        return data[0].map(this.normalize);
      } else {
        return null;
      }
    } catch (err) {
      logger.error('Error while fetching rate:.');
      logger.error(err);
    }
  }

  async getEverything() {
    try {
      const data = await this.connection.execute(
        `select * from RATES 
        order by date desc, type, currency desc`
      );

      if (data[0].length) {
        return data[0].map(this.normalize);
      } else {
        return null;
      }
    } catch (err) {
      logger.error('Error while fetching rate:.');
      logger.error(err);
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
      logger.error('Error while deleting rate.');
      logger.error(err);
    }
  }

  async getEarliestDate() {
    try {
      const data = await this.connection.execute(
        'select min(date) as earliest from RATES'
      );

      return new moment(data[0][0].earliest);
    } catch (err) {
      logger.error('Error while fetching rate:.');
      logger.error(err);
    }
  }

  normalize(rate) {
    const {
      date,
      currency,
      point_date,
      type,
      ask,
      bid,
      trend_ask,
      trend_bid,
      max_ask,
      min_bid
    } = rate;

    return {
      date: new moment(date),
      pointDate: new moment(point_date),
      currency,
      type,
      ask: +ask,
      bid: +bid,
      trendAsk: +trend_ask,
      trendBid: +trend_bid,
      maxAsk: +max_ask,
      minBid: +min_bid
    };
  }
}

const rates = new Rates();

export default rates;
