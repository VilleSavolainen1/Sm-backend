require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool();

pool.connect()