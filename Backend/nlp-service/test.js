const axios = require("axios");

axios
  .post("http://localhost:3002/api/nlp/analyze", {
    text: "Great community!",
    community_id: 1
  })
  .then(res => console.log(res.data))
  .catch(err => console.error(err.response?.data || err.message));
