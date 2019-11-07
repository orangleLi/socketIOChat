const fs = require('fs');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require("socket.io")(http);
// 路由为/默认www静态文件夹
app.use('/', express.static(__dirname + '/src'));

// 后台接口，读取本地图片资源
let portrait = fs.readdirSync('./src/static/portrait')
let emoji = fs.readdirSync('./src/static/emoticon/emoji')
let emot = fs.readdirSync('./src/static/emoticon/emot')
app.get('*', (req, res) => {
    const assetsType = req.url.split('/')[1];
    if (assetsType === 'loadImg') {
        res.send({
            code: 0,
            data: {
                portrait,
                emoji,
                emot
            },
            msg: '操作成功'
        })
    }
})

let userList = [];
let chatGroupList = {};
io.on('connection', (socket) => {
	// 前端调用发送消息接口，后端接收到并广播
	socket.on('login', (userInfo) => {
        userList.push(userInfo);
        io.emit('userList', userList);
        // socket.emit(给该socket的客户端发送消息) + socket.broadcast.emit(发给所以客户端，不包括自己)  = io.emit(给所有客户端广播消息)
	})

    socket.on('sendMsg', (data) => {
        socket.to(data.id).emit('receiveMsg', data)
	})

    socket.on('sendMsgGroup', (data) => {
        socket.to(data.roomId).emit('receiveMsgGroup', data);
    })

    // 创建群聊
    socket.on('createChatGroup', data => {
        socket.join(data.roomId);

        chatGroupList[data.roomId] = data;
        data.member.forEach(item => {
            io.to(item.id).emit('chatGroupList', data)
            io.to(item.id).emit('createChatGroup', data)
            // socket.to 本人没有收到
            // io.to 所有人都收到了
        });
    })

    // 加入群聊
    socket.on('joinChatGroup', data => {
        socket.join(data.info.roomId);
        io.to(data.info.roomId).emit('chatGrSystemNotice', {
            roomId: data.info.roomId,
            msg: data.userName+'加入了群聊!',
            system: true
        });//为房间中的所有的socket发送消息, 包括自己
    })

    socket.on('leave', data => {
        socket.leave(data.roomId, () => {
            let member = chatGroupList[data.roomId].member;
            let i = -1;
            member.forEach((item, index) => {
                if (item.id === socket.id) {
                    i = index;
                }
                io.to(item.id).emit('leaveChatGroup', {
                    id: socket.id, // 退出群聊人的id
                    roomId: data.roomId,
                    msg: data.userName+'离开了群聊!',
                    system: true
                })
            });
            if (i !== -1) {
                member.splice(i)
            }
        });
    })

    // 退出（内置事件）
    socket.on('disconnect', () => {
        chatGroupList = {};
        userList = userList.filter(item => item.id != socket.id)
        io.emit('quit', socket.id)
    })
})

http.listen(3001, () => {
	console.log('http://localhost:3001/index.html')
});
