import Dexie from 'dexie';

export const db = (function () {
  const db = {};

  db.initDB = () => {
    return new Promise((resolve, reject) => {
      const players = '&puid, hash, cuid, &id, [last_name+first_name], last_name, birthdate';
      const matches = '&muid, *puids, format, date, tournament.category, tournament.tuid';
      const points = '[puid+tuid+format+round], puid, tuid, muid, date';
      const tournaments = '&tuid, name, start, end, category, cuid';
      const calculations = '&hash, date, type';
      const themes = '&uuid, name';
      const ignored = '[hash+ioc]';
      const teams = '&uuid, name';
      const rankings = 'category';
      const clubs = '&id, &code';
      const aliases = '&alias';
      const settings = 'key';
      const idioms = 'ioc';
      const core = { calculations, clubs, idioms, matches, players, points, rankings, settings, tournaments };
      db.db = new Dexie('CourtHiveTournaments', { autoOpen: false });
      db.db.version(1).stores({ aliases, ignored, ...core });
      db.db.version(2).stores({ aliases, ignored, ...core, idioms });
      db.db.version(3).stores({ teams, themes, idioms, ...core });
      db.db.open().then(resolve, reject);
    });
  };

  db.resetDB = (callback) => {
    db.db.close();
    Dexie.delete('CourtHiveTournaments').then(callback, () => alert('Failed to Reset Database'));
  };

  db.findAll = (table) => {
    return new Promise((resolve, reject) => {
      let target_table = db.db[table];
      if (target_table) {
        return target_table.toArray(resolve, reject).catch(reject);
      } else {
        return resolve([]);
      }
    });
  };
  db.findAllTournaments = () => db.findAll('tournaments');

  db.findWhere = (tbl, attr, val) =>
    new Promise((resolve, reject) => db.db[tbl].where(attr).equals(val).toArray(resolve, reject).catch(reject));

  db.deleteTournament = (tuid) => {
    return new Promise((resolve, reject) => {
      db.db.tournaments.where('tuid').equals(tuid).delete().then(deleteTournamentMatches, reject);
      function deleteTournamentMatches() {
        db.deleteTournamentMatches(tuid).then(deleteTournamentPoints, reject);
      }
      function deleteTournamentPoints() {
        db.deleteTournamentPoints(tuid).then(resolve, reject);
      }
    });
  };

  // dangerous!
  db.deleteAllTournamentAttr = (attr) =>
    db.db.tournaments
      .toCollection()
      .modify((tournament) => delete tournament[attr])
      .then(() => console.log('done'));

  db.findUnique = (tbl, attr, val) =>
    new Promise((resolve, reject) =>
      db.findWhere(tbl, attr, val).then((d) => resolve(d && d.length ? d[0] : undefined), reject)
    );
  db.findTournament = (tuid) => db.findUnique('tournaments', 'tuid', tuid);
  db.addItem = (tbl, item) =>
    new Promise((resolve, reject) =>
      db.db[tbl]
        .put(item)
        .then(resolve, reject)
        .catch((err) => {
          alert('try again:', err);
          reject(err);
        })
    );

  db.modifyOrAddUnique = (tbl, attr, val, item) =>
    new Promise((resolve, reject) => {
      db.db[tbl]
        .where(attr)
        .equals(val)
        .modify((data) => Object.assign(data, item))
        .then(
          (result) => {
            if (result) {
              return resolve('exists');
            } else {
              db.addItem(tbl, item).then(resolve, reject);
            }
          },
          (err) => {
            console.log(err);
            reject(err);
          }
        );
    });

  db.addTournament = (tournament) => db.modifyOrAddUnique('tournaments', 'tuid', tournament.tuid, tournament);
  db.replaceOrAddUnique = (tbl, attr, val, item) =>
    new Promise((resolve, reject) => {
      db.db[tbl]
        .where(attr)
        .equals(val)
        .delete()
        .then(
          () => {
            db.addItem(tbl, item).then(resolve, reject);
          },
          (err) => {
            console.log(err);
            reject(err);
          }
        );
    });

  db.modify = (tbl, attr, val, fx, params) =>
    new Promise((resolve, reject) => {
      db.db[tbl]
        .where(attr)
        .equals(val)
        .modify((item) => {
          Object.assign(params, { item });
          fx(params);
        })
        .then(resolve, (err) => {
          console.log('error:', err);
          reject();
        });
    });

  return db;
})();
