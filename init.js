const db = require('./db');
const log = require('./log');
const logger = log.defaultLogger;

async function creatTables(err,conn){
	if(err){
		logger.error(err);
		return;
	}
	//清除数据
	let sqls = [
		'drop table if exists t_tiny_url;',
		'drop table if exists t_tiny_url_occupy;',

		`create table if not exists t_tiny_url(
			id bigint primary key auto_increment comment '主键',
			tiny_url varchar(32) unique comment '短网址',
			long_url varchar(767) unique comment '长网址',
			key t_tiny_url_idx_tiny_url(tiny_url),
			key t_tiny_url_idx_long_url(long_url)
		) comment '短网址';`,
		`create table if not exists t_tiny_url_occupy(
			tiny_url varchar(32) unique comment '短网址',
			occupy_id bigint unique comment '占用该短网址的id',
			key t_tiny_url_occupy_idx_tiny_url(tiny_url),
			key t_tiny_url_occupy_idx_occupy_id(occupy_id)
		) comment '短网址被id的占用关系';`
	];
	//logger.info(sqls);
	let params = [];
	await Promise.all(sqls.map(sql=>db.query({conn,sql,params})));
}
let test = async function(){
	await db.doInTx(creatTables);
}
test().then(data=>{
	logger.info(`data=${data}`);
	db.pool.end();
},err=>{
	logger.error(`err=${err}`);
	db.pool.end();
});