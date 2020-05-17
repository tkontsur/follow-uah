import ratesHistory from '../database/ratesHistory.js';

class InstantMetrics {
  updateMetrics(type, days) {
    const t = days[0];
    const y = days[1];
    const currentTrend = ratesHistory.getLatestRateSync(type, t.currency);

    if (!currentTrend) {
      currentTrend = y;
    }

    if (!y && !currentTrend) {
      return 0;
    }

    // rate has changed direction since yesterday
    if (
      currentTrend.trend * t.trendAsk < 0 ||
      currentTrend.trend * t.trendBid < 0
    ) {
      // minimum is more than 1% higher than maximum yesterday
      if (t.bid > y.maxAsk && t.trendBid > 0) {
        return 1;
      }

      // maximum is more than 1% lower than minimum yesterday
      if (t.ask < y.minBid && t.trendAsk < 0) {
        return -1;
      }
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

    return 0;
  }
}

export default new InstantMetrics();
