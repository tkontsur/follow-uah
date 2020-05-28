import moment from 'moment-timezone';
import restClient from './restclient.js';
import rates2 from '../database/rates-dynamo.js';
import ratesHistory from '../database/ratesHistory.js';
import users from '../database/users.js';

export async function invokeTest(test) {
  if (typeof tests[test] === 'function') {
    return await tests[test]();
  } else {
    return 'Not found';
  }
}
const tests = {
  async fetchnow() {
    const server = await restClient.fetchData('2020-04-08');

    return `Server ${JSON.stringify(server)}`;
  },

  async getrates() {
    return await rates2.getDate('MB', 'usd', new moment('2020-04-08'));
  },

  async allusers() {
    return await users.getSubscribedChats();
  },

  async metrics() {
    console.log('*** Start instant metrics test ***');
    const realSubscribers = restClient.subscribers;
    const realRecord = ratesHistory.record;

    if (!realSubscribers.update.length) {
      throw 'Subscribers were not an array';
    }

    ratesHistory.record = ratesHistory.setLocal;
    restClient.subscribers.update = [
      (metrics, state) => {
        Object.keys(state).forEach((c) => {
          const { date, ask, trendAsk, maxAsk } = state[c][0];
          console.log(
            `Result for ${date} (${ask}, T: ${trendAsk}, M: ${maxAsk}) trend ${metrics[c]}`
          );
        });
      }
    ];

    await Promise.all(
      ['usd', 'eur'].map(async (c) => {
        const allData = await rates2.getEverything('MB', c);
        const count = allData.length;
        const startTrend = {
          ...allData[count - 1],
          trend: allData[count - 1].trendAsk
        };

        console.log(`Evaluating ${c}`);
        ratesHistory.setLocal(startTrend);

        for (let i = count - 2; i >= 0; i--) {
          const lastUpdate = ratesHistory.getLatestRateSync('MB', c);
          const last = allData.findIndex((d) =>
            d.date.isSame(lastUpdate.date, 'd')
          );
          const today = allData.slice(i, last + 1);

          const result = await restClient.updateMetrics('MB', { [c]: today });
          const { date, maxAsk, minBid } = today[0];

          if (result[c]) {
            ratesHistory.setLocal({
              type: 'MB',
              currency: c,
              date,
              maxAsk,
              minBid,
              trend: result[c]
            });
          }
        }

        return true;
      })
    );

    restClient.subscribers = realSubscribers;
    ratesHistory.record = realRecord;
    return 'Done';
  },

  async resethistory() {
    restClient.redisSet('nextHistory', new moment().format('YYYY-MM-DD'));
    restClient.nextHistory = new moment();
    return `Reset to ${new moment().format('YYYY-MM-DD')}`;
  },

  async revise() {
    restClient.reviseDay();
    return 'Done';
  },

  async today() {
    const today = restClient.state.MB.eur[0];
    const trendAsk = -today.trendAsk;
    const trendBid = -today.trendBid;
    const ask = today.maxAsk + trendAsk * 2;
    const bid = today.minBid + trendBid * 2;
    const tomorrow = {
      ...today,
      ask,
      bid,
      trendAsk,
      trendBid
    };

    const result = await restClient.updateMetrics(
      'MB',
      { eur: [tomorrow, today] },
      true
    );

    return result.eur;
  },

  trigger() {
    restClient.trigger('update', { usd: 1, eur: 0 }, restClient.state, 'MB');
  },

  state() {
    console.log(JSON.stringify(restClient.state));
    return (
      restClient.state.MB.usd.length + ' ' + restClient.state.MB.eur.length
    );
  }
};
