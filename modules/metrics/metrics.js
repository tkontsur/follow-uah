import moment from 'moment-timezone';
import ratesHistory from '../database/ratesHistory.js';
//import logger from '../utils/logger.js';

class Metrics {
  instantMetrics(type, days) {
    const t = days[0];
    const y = days[1];
    const currentTrend = ratesHistory.getLatestRateSync(type, t.currency);

    if (days.length <= 1) {
      return 0;
    }

    /*logger.info(`T: ${t.date} ${t.ask} ${t.bid} ${t.trendAsk} ${t.trendBid}`);
    logger.info(`Y: ${y.date} ${y.ask} ${y.bid} ${y.trendAsk} ${y.trendBid} ${y.maxAsk} ${y.minBid}`);
    logger.info(`Trend: ${currentTrend.date} ${currentTrend.maxAsk} ${currentTrend.minBid} ${currentTrend.trend}`);*/

    if (!currentTrend) {
      currentTrend = {
        ...y,
        trend: y.trendAsk
      };
    }

    // rate has changed direction since yesterday
    if (
      currentTrend.trend * t.trendAsk < 0 ||
      currentTrend.trend * t.trendBid < 0
    ) {
      // minimum is more than higher than maximum yesterday
      if (t.bid > y.maxAsk && t.trendBid > 0) {
        return 1;
      }

      // maximum is more than lower than minimum yesterday
      if (t.ask < y.minBid && t.trendAsk < 0) {
        return -1;
      }

      // if data is controversional then check against the day before
      const y1 = days.find(
        (d) => d.trendAsk * t.trendAsk < 0 || d.trendBid * t.trendBid < 0
      );
      if (!y1 || !y1.date.isBefore(y.date, 'd')) {
        return 0;
      }

      if (t.ask < y1.minBid && t.trendAsk < 0) {
        return -2;
      }

      if (t.bid > y1.maxAsk && t.trendBid > 0) {
        return 2;
      }
    }

    return 0;
  }

  dailyMetrics(type, days) {
    const t = days[0];
    const y = days[1];
    const currentTrend = ratesHistory.getLatestRateSync(type, t.currency);

    if (days.length <= 1) {
      return 0;
    }

    if (!currentTrend) {
      currentTrend = {
        ...y,
        trend: y.trendAsk
      };
    }

    if (new moment().diff(currentTrend.date, 'd') < 2) {
      return 0;
    }

    const realAsk = t.ask - y.ask;
    const realBid = t.bid - y.bid;

    // trends are misleading
    if (currentTrend.trend * realAsk < 0 || currentTrend.trend * realBid < 0) {
      // minimum is higher than maximum yesterday
      if (t.bid > y.maxAsk && realBid > 0) {
        return `Сьогодні ${t.currency} `;
      }

      // maximum is lower than minimum yesterday
      if (t.ask < y.minBid && realAsk < 0) {
        return -3;
      }
    }

    return 0;
  }

  weeklyMetrics(type) {
    const currentTrends = ratesHistory.getAllTriggered();

    if (new moment().diff(currentTrend.date, 'd') < 2) {
      return 0;
    }
  }
}

export default new Metrics();
