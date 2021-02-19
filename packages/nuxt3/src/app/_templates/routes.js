// TODO: Use webpack-virtual-modules
export default <%= nxt.serialize(app.routes.map(nxt.serializeRoute)) %>
