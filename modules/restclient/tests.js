import moment from 'moment-timezone';
import restClient from './restclient.js';
import rates2 from '../database/rates-dynamo.js';
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
    ['usd', 'eur'].forEach(async (c) => {
      const allData = await rates2.getEverything('MB', c);

      const count = allData.length;
      console.log(`Evaluating ${c}`);
      for (let i = 0; i < count - 2; i++) {
        const today = allData.slice(i, count - 1);

        const result = await restClient.updateMetrics(
          'MB',
          { [c]: today },
          true
        );
        const { date, ask, trendAsk, maxAsk } = today[0];
        console.log(
          `Result for ${date} (${ask}, T: ${trendAsk}, M: ${maxAsk}) trend ${result[c]}`
        );
      }
    });
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
  }
};
