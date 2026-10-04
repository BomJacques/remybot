import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const companions=sqliteTable('companions',{userId:text('user_id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(1)});
