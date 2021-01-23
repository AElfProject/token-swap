// const HDWalletProvider = require('@truffle/hdwallet-provider');
// const infuraKey = "fj4jll3k.....";
//
// const fs = require('fs');
// const mnemonic = fs.readFileSync(".secret").toString().trim();

module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            network_id: "*",
            port: 8545,
            gas: 8000000,
            gasPrice: 0
            // gasPrice: 10000000000, // 10 gwei
        },
    },

    // Configure your compilers
    compilers: {
        solc: {
            version: "0.6.12",
            // settings: {          // See the solidity docs for advice about optimization and evmVersion
            //  optimizer: {
            //    enabled: false,
            //    runs: 200
            //  },
            //  evmVersion: "byzantium"
            // }
        },
    },
};
