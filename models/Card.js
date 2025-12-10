const { Schema, model } = require('mongoose')
const CardSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  }
});
module.exports = model('Card', CardSchema);


