const http = require('http');
const url = require('url');
const querystring = require('querystring');

const tiny = require('./tiny');
// 创建一个 HTTP 服务器
const server = http.createServer( async(req, res) => {
	try{
		const reqUrl = url.parse(req.url);
		//这里没有用到框架，因为我们的需求非常简单
		const handler = {
			'/gen-tiny-url':'generateTinyUrl',
			'/cust-tiny-url':'customTinyUrl'
		};
		const pathname = reqUrl.pathname;
		//TODO 添加一个处理，访问短网址的时候，重定向到长网址
		//TODO 添加一个处理，查询短网址对应的长网址
		//TODO 添加一个处理，查询长网址对应的短网址，如果不存在，返回空
		if(!handler[pathname]){
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('404');
			return;
		};
		const arg = querystring.parse(reqUrl.query);
		console.info(arg);
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		const rows = await tiny[handler[pathname]](arg);
		//console.info(rows);
		res.write(JSON.stringify(rows));
		res.end();
	}catch(e){
		console.error(e);
		res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end('500');
	}

});
server.on('clientError', (err, socket) => {
	socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
// 服务器正在运行
server.listen(1337);