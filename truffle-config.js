const HDWalletProvider = require("truffle-hdwallet-provider");
const env = require('./env.js');

module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            network_id: "*",
            port: 8545,
            gas: 8000000,
            gasPrice: 10000000000, // 10 gwei
        },
        kovan: {
            provider: function () {
                return new HDWalletProvider(env.keys, env.kovan, 0, env.keys.length)
            },
            network_id: 42,
            gas: 10000000,
            gasPrice : 10000000000, //10 GWei
            networkCheckTimeout: 10000000
        },
    },

    // Configure your compilers
    compilers: {
        solc: {
            version: "0.6.12"
        },
    },
};
