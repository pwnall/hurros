import { MatchModel, readMatch } from './db/match';

const main = async () => {
  const old_records = await MatchModel.findAll({
    where: { data_version: '1' }, attributes: [ 'id' ],
  });

  for (let record of old_records)
    await readMatch(record.id);
};

main();