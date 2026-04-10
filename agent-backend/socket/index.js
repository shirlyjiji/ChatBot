module.exports = (io) => {
    io.on('connection', (socket) => {
      socket.on('join', (conversationId) => {
        socket.join(conversationId);
      });
  
      socket.on('message', ({ conversationId, message }) => {
        io.to(conversationId).emit('message', message);
      });
    });
  };
  