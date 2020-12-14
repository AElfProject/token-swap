const ReceiptMaker = artifacts.require('ReceiptMaker');
const ERC20 = artifacts.require('ERC20');
const receiptMakerAddress = '0x77dEd54453A40042632F36bC93A6f48061395DA9';
const tokenAddress = '0xB5685232b185cAdF7C5F58217722Ac40BC4ec45e';
const sender = '0x2D4E11221b960E4Ed6D0D2358e26b9c89DfF404a';

module.exports = async function () {

    // approve token
    this.token = await ERC20.at(tokenAddress);
    await this.token.approve(receiptMakerAddress, 10000000000000, {from: sender});

    this.receiptMaker = await ReceiptMaker.at(receiptMakerAddress);
    let targetAddress = '28Y8JA1i2cN6oHvdv7EraXJr9a1gY6D1PpJXw9QtRMRwKcBQMK';

    // create receipt
    await this.receiptMaker.createReceipt(10000000000000, targetAddress, {from: sender});

    // get receipt id(s)
    let myReceipts = await this.receiptMaker.getMyReceipts.call(sender);
    let myReceiptId = myReceipts[myReceipts.length - 1];

    // get receipt info
    let receiptInfo = await this.receiptMaker.getReceiptInfo.call(myReceiptId);
}