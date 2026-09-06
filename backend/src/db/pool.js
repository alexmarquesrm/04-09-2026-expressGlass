const { Pool, types } = require('pg');

// DATE columns have no time-of-day component, so they should never become a JS
// Date object: pg's default parser builds one at local midnight, and JSON
// serialization (.toISOString()) then converts that to UTC - shifting the
// calendar day whenever the server's local UTC offset isn't exactly 0 (e.g.
// TZ=Europe/Lisbon during DST). Returning the raw 'YYYY-MM-DD' string avoids
// that whole class of bug.
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
