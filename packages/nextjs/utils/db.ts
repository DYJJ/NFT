// utils/db.ts
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'dyj20030330',  
  database: 'nft',         
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const connectToDatabase = async () => {
  try {
    return pool.getConnection();
  } catch (error) {
    console.error("Error getting database connection from pool:", error);
    throw error;
  }
};
