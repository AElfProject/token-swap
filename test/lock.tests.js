const {expectRevert} = require('@openzeppelin/test-helpers');
const ReceiptMaker = artifacts.require('ReceiptMaker');
const TOKEN = artifacts.require('MockToken');
var crypto = require('crypto');
const truffleAssert = require('truffle-assertions');


contract("ReceiptMaker", (accounts) => {
    let owner = accounts[0];
    beforeEach(async () => {
        this.token = await TOKEN.new('TOKEN', 'T', {from: owner});
        this.locker = await ReceiptMaker.new(this.token.address, '0x000000000000000000000000000000000000dead', {from: owner});
    });

    it("constructor", async () => {
        assert.equal(await this.locker.asset.call(), this.token.address);
        assert.equal(await this.locker.receiver.call(), '0x000000000000000000000000000000000000dEaD');
    });

    it("createReceipt without allowance", async () => {
        await expectRevert(this.locker.createReceipt('100', 'CREATE', {from: owner}), "ERC20: transfer amount exceeds allowance.");
    });

    it("createReceipt with allowance", async () => {
        await this.token.approve(this.locker.address, '100', {from: owner});
        await expectRevert(this.locker.createReceipt('101', 'CREATE', {from: owner}), "ERC20: transfer amount exceeds allowance.");
        await this.locker.createReceipt('100', 'CREATE', {from: owner});
        let receiptCount = await this.locker.receiptCount.call();
        assert.equal(receiptCount, 1);
        let myReceipts = await this.locker.getMyReceipts.call(owner);
        assert.equal(myReceipts.length, 1);
        assert.equal(myReceipts[0], 0);

        let lockedToken = await this.locker.getMyReceiptsAmount.call(owner);
        assert.equal(lockedToken, 100);

        let receiptInfo = await this.locker.getReceiptInfo.call(0);
        let receiptIdInStr = web3.eth.abi.encodeParameter('uint256', '0');
        let receiptIdHashInHex = crypto.createHash('sha256').update(Buffer.from(receiptIdInStr.substring(2), 'hex')).digest('hex');

        assert.equal(receiptInfo[0].substring(2), receiptIdHashInHex);
    });


    it("createReceipt multi times", async () => {
        await this.token.approve(this.locker.address, '100', {from: owner});

        {
            var targetAddress = 'CREATE1';
            var amount = 30;
            let create = await this.locker.createReceipt(amount, targetAddress, {from: owner});

            let receiptId = 0;
            truffleAssert.eventEmitted(create, 'NewReceipt', (res) => {
                receiptId = res.receiptId.toNumber();
                return res.receiptId.toNumber() === 0
                    && res.asset === this.token.address
                    && res.amount.toNumber() === amount
                    && res.owner === owner;
            });
            let receiptCount = await this.locker.receiptCount.call();
            assert.equal(receiptCount, 1);
            let myReceipts = await this.locker.getMyReceipts.call(owner);
            assert.equal(myReceipts.length, 1);
            assert.equal(myReceipts[0], receiptId);

            let lockedToken = await this.locker.getMyReceiptsAmount.call(owner);
            assert.equal(lockedToken, amount);

            let receiptInfo = await this.locker.getReceiptInfo.call(receiptId);
            let receiptIdInStr = web3.eth.abi.encodeParameter('uint256', receiptId);
            let receiptIdHashInHex = crypto.createHash('sha256').update(Buffer.from(receiptIdInStr.substring(2), 'hex')).digest('hex');

            assert.equal(receiptInfo[0].substring(2), receiptIdHashInHex);
            assert.equal(receiptInfo[1], targetAddress);
            assert.equal(receiptInfo[2], amount);
        }

        {
            var targetAddress = 'CREATE2';
            var amount = 100;
            await this.token.approve(this.locker.address, amount, {from: accounts[1]});
            await this.token.transfer(accounts[1], amount, {from: owner});
            let balanceBefore = await this.token.balanceOf.call(accounts[1]);
            assert.equal(balanceBefore, amount);

            let create = await this.locker.createReceipt(amount, targetAddress, {from: accounts[1]});

            let receiptId = 0;
            truffleAssert.eventEmitted(create, 'NewReceipt', (res) => {
                receiptId = res.receiptId.toNumber();
                return res.receiptId.toNumber() === 1
                    && res.asset === this.token.address
                    && res.amount.toNumber() === amount
                    && res.owner === accounts[1];
            });

            let balanceAfter = await this.token.balanceOf.call(accounts[1]);
            assert.equal(balanceAfter, 0);

            let receiptCount = await this.locker.receiptCount.call();
            assert.equal(receiptCount, 2);
            let myReceipts = await this.locker.getMyReceipts.call(accounts[1]);
            assert.equal(myReceipts.length, 1);
            assert.equal(myReceipts[0], receiptId);

            let lockedToken = await this.locker.getMyReceiptsAmount.call(accounts[1]);
            assert.equal(lockedToken, amount);

            let receiptInfo = await this.locker.getReceiptInfo.call(receiptId);
            let receiptIdInStr = web3.eth.abi.encodeParameter('uint256', receiptId);
            let receiptIdHashInHex = crypto.createHash('sha256').update(Buffer.from(receiptIdInStr.substring(2), 'hex')).digest('hex');

            assert.equal(receiptInfo[0].substring(2), receiptIdHashInHex);
            assert.equal(receiptInfo[1], targetAddress);
            assert.equal(receiptInfo[2], amount);
        }

        {
            var targetAddress = 'CREATE3';
            var amount = 70;
            let create = await this.locker.createReceipt(amount, targetAddress, {from: owner});

            let receiptId = 0;
            truffleAssert.eventEmitted(create, 'NewReceipt', (res) => {
                receiptId = res.receiptId.toNumber();
                return res.receiptId.toNumber() === 2
                    && res.asset === this.token.address
                    && res.amount.toNumber() === amount
                    && res.owner === owner;
            });
            let receiptCount = await this.locker.receiptCount.call();
            assert.equal(receiptCount, 3);
            let myReceipts = await this.locker.getMyReceipts.call(owner);
            assert.equal(myReceipts.length, 2);
            assert.equal(myReceipts[1], receiptId);

            let lockedToken = await this.locker.getMyReceiptsAmount.call(owner);
            assert.equal(lockedToken, 100);

            let receiptInfo = await this.locker.getReceiptInfo.call(receiptId);
            let receiptIdInStr = web3.eth.abi.encodeParameter('uint256', receiptId);
            let receiptIdHashInHex = crypto.createHash('sha256').update(Buffer.from(receiptIdInStr.substring(2), 'hex')).digest('hex');

            assert.equal(receiptInfo[0].substring(2), receiptIdHashInHex);
            assert.equal(receiptInfo[1], targetAddress);
            assert.equal(receiptInfo[2], amount);
        }
    });

    // it("finishReceipt", async () => {
    //     await this.token.approve(this.locker.address, '100', {from: owner});
    //
    //     var targetAddress = 'CREATE1';
    //     var amount = 30;
    //     let create = await this.locker.createReceipt(amount, targetAddress, {from: owner});
    //     let receiptId = 0;
    //     truffleAssert.eventEmitted(create, 'NewReceipt', (res) => {
    //         receiptId = res.receiptId.toNumber();
    //         return res.receiptId.toNumber() === 0
    //             && res.asset === this.token.address
    //             && res.amount.toNumber() === amount
    //             && res.owner === owner;
    //     });
    //     {
    //         let receiptCount = await this.locker.receiptCount.call();
    //         assert.equal(receiptCount, 1);
    //         let myReceipts = await this.locker.getMyReceipts.call(owner);
    //         assert.equal(myReceipts.length, 1);
    //         assert.equal(myReceipts[0], receiptId);
    //
    //         let lockedToken = await this.locker.getMyReceiptsAmount.call(owner);
    //         assert.equal(lockedToken, amount);
    //
    //         let receiptInfo = await this.locker.getReceiptInfo.call(receiptId);
    //         assert.equal(receiptInfo[3], false);
    //     }
    //
    //     await sleep(10000);
    //     let finish = await this.locker.finishReceipt(0, {from: owner});
    //     truffleAssert.eventEmitted(finish, 'ReceiptFinished', (res) => {
    //         return res.receiptId.toNumber() === 0
    //             && res.asset === this.token.address
    //             && res.amount.toNumber() === amount
    //             && res.owner === owner;
    //     });
    //
    //     {
    //         let receiptCount = await this.locker.receiptCount.call();
    //         assert.equal(receiptCount, 1);
    //         let myReceipts = await this.locker.getMyReceipts.call(owner);
    //         assert.equal(myReceipts.length, 1);
    //         assert.equal(myReceipts[0], receiptId);
    //
    //         let lockedToken = await this.locker.getMyReceiptsAmount.call(owner);
    //         assert.equal(lockedToken, 0);
    //
    //         let receiptInfo = await this.locker.getReceiptInfo.call(receiptId);
    //         assert.equal(receiptInfo[3], true);
    //     }
    // });
})
