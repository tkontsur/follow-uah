class InstantMetrics {
  updateMetrics(days) {
    const t = days[0];
    const y = days[1];

    if (!y) {
      return 0;
    }

    // rate has changed direction since yesterday
    if (y.trendAsk * t.trendAsk < 0 || y.trendBid * t.trendBid < 0) {
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
    const y1 = days[1];
    if (!y1) {
      return 0;
    }

    if (
      (t.ask - y.ask) * t.trendAsk < 0 &&
      t.ask < y1.minBid &&
      t.trendAsk < 0
    ) {
      return -2;
    }

    if (
      (t.bid - y.bid) * t.trendBid < 0 &&
      t.bid > y1.maxAsk &&
      t.trendBiod > 0
    ) {
      return 2;
    }

    // if no visible trends but the rate has changed significantly
    if (t.ask < y1.minBid * 0.98) {
      return -3;
    }

    if (t.bid > y1.maxAsk * 1.02) {
      return 3;
    }

    return 0;
  }
}

export default new InstantMetrics();
