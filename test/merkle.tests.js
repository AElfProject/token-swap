const {expectRevert} = require('@openzeppelin/test-helpers');
const ReceiptMaker = artifacts.require('ReceiptMaker');
const TOKEN = artifacts.require('MockToken');
const MERKLE = artifacts.require('MerkleTreeGenerator');
var crypto = require('crypto');

function calculateNodeHash(amount, target, receiptId) {
    let amountInStr = web3.eth.abi.encodeParameter('uint256', amount.toString());
    let amountHashInHex = crypto.createHash('sha256').update(Buffer.from(amountInStr.substring(2), 'hex')).digest('hex');

    let targetAddressHashInHex = crypto.createHash('sha256').update(target).digest('hex');

    let receiptIdInStr = web3.eth.abi.encodeParameter('uint256', receiptId.toString());
    let receiptIdHashInHex = crypto.createHash('sha256').update(Buffer.from(receiptIdInStr.substring(2), 'hex')).digest('hex');

    return crypto.createHash('sha256').update(Buffer.from(amountHashInHex + targetAddressHashInHex + receiptIdHashInHex, 'hex')).digest('hex');
}

function calculateWithPath(node, neighbors, positions) {
    let root = node.startsWith('0x') ? node.substring(2) : node;
    for (let i = 0; i < neighbors.length; i++) {
        if (positions[i])
            root = crypto.createHash('sha256').update(Buffer.from(neighbors[i].substring(2) + root, 'hex')).digest('hex');
        else
            root = crypto.createHash('sha256').update(Buffer.from(root + neighbors[i].substring(2), 'hex')).digest('hex');
    }
    return root;
}

contract("MERKLE", (accounts) => {
    let owner = accounts[0];
    beforeEach(async () => {
        this.token = await TOKEN.new('TOKEN', 'T', {from: owner});
        this.locker = await ReceiptMaker.new(this.token.address, '0x000000000000000000000000000000000000dead',{from: owner});
        this.merkle = await MERKLE.new(this.locker.address, {from: owner});
    });

    it("constructor", async () => {
        assert.equal(await this.merkle.receiptProviderAddress.call(), this.locker.address);
    });

    it("RecordReceipts not owner", async () => {
        await expectRevert(this.merkle.recordReceipts({from: accounts[1]}), 'Ownable: caller is not the owner');
    });

    it("RecordReceipts without receipt", async () => {
        await expectRevert(this.merkle.recordReceipts({from: owner}), '[MERKLE]No receipts.');
    });

    it("RecordReceipts with 1 receipt", async () => {
        await this.token.approve(this.locker.address, '100000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA', {from: owner});
        await this.merkle.recordReceipts({from: owner});

        assert.equal(await this.merkle.merkleTreeCount.call(), 1);
        let tree = await this.merkle.getMerkleTree.call(0);
        assert.equal(tree[1].toString(), '0'); // first receipt id
        assert.equal(tree[2].toString(), '1'); // receipt count
        assert.equal(tree[3].toString(), '3'); // tree size
        assert.equal(tree[4].length, 3); //tree node length

        let treeNodes = tree[4];
        assert.equal(tree[0], treeNodes[2]);

        let hashResult = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        assert.equal(hashResult, treeNodes[0].substring(2));

        let path = await this.merkle.generateMerklePath.call(0);
        assert.equal(path[0], 0);

        assert.equal(path[1], 1);

        assert.equal(path[2].length, 1);
        assert.equal(path[2][0].toString().substring(2), hashResult);

        assert.equal(path[3].length, 1);
        assert.equal(path[3][0], false);

        let calculatedRoot = calculateWithPath(hashResult, path[2], path[3]);
        assert.equal(calculatedRoot, tree[0].substring(2));
    });

    it("RecordReceipts with 2 receipts", async () => {
        await this.token.approve(this.locker.address, '300000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA', {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB', {from: owner});

        await this.merkle.recordReceipts({from: owner});

        assert.equal(await this.merkle.merkleTreeCount.call(), 1);
        let tree = await this.merkle.getMerkleTree.call(0);
        assert.equal(tree[1].toString(), '0'); // first receipt id
        assert.equal(tree[2], 2); // receipt count
        assert.equal(tree[3], 3); // tree size
        assert.equal(tree[4].length, 3); //tree node length

        let treeNodes = tree[4];
        assert.equal(tree[0], treeNodes[2]);

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);
        assert.equal(node1, treeNodes[0].substring(2));
        assert.equal(node2, treeNodes[1].substring(2));

        {
            let path = await this.merkle.generateMerklePath.call(0);
            assert.equal(path[0], 0);
            assert.equal(path[1], 1);
            assert.equal(path[2].length, 1);
            assert.equal(path[2][0].toString().substring(2), node2);

            assert.equal(path[3].length, 1);
            assert.equal(path[3][0], false);

            let calculatedRoot = calculateWithPath(node1, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1);
            assert.equal(path[0], 0);
            assert.equal(path[1], 1);
            assert.equal(path[2].length, 1);
            assert.equal(path[2][0].toString().substring(2), node1);

            assert.equal(path[3].length, 1);
            assert.equal(path[3][0], true);

            let calculatedRoot = calculateWithPath(node2, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }
    });

    it("RecordReceipts with 3 receipts", async () => {
        await this.token.approve(this.locker.address, '600000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA', {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB', {from: owner});
        await this.locker.createReceipt('300000', 'CCCCCCCCC', {from: owner});

        await this.merkle.recordReceipts({from: owner});

        assert.equal(await this.merkle.merkleTreeCount.call(), 1);
        let tree = await this.merkle.getMerkleTree.call(0);
        assert.equal(tree[1].toString(), '0'); // first receipt id
        assert.equal(tree[2], 3); // receipt count
        assert.equal(tree[3], 7); // tree size
        assert.equal(tree[4].length, 7); //tree node length

        let treeNodes = tree[4];
        assert.equal(tree[0], treeNodes[6]);

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);
        let node3 = calculateNodeHash(300000, 'CCCCCCCCC', 2);

        assert.equal(node1, treeNodes[0].substring(2));
        assert.equal(node2, treeNodes[1].substring(2));
        assert.equal(node3, treeNodes[2].substring(2));

        {
            let path = await this.merkle.generateMerklePath.call(0);
            assert.equal(path[0], 0); //tree index
            assert.equal(path[1], 2); // path length
            assert.equal(path[2].length, 2);
            assert.equal(path[2][0].toString().substring(2), node2);
            assert.equal(path[2][1].toString(), treeNodes[5]);

            assert.equal(path[3].length, 2);
            assert.equal(path[3][0], false);
            assert.equal(path[3][1], false);

            let calculatedRoot = calculateWithPath(node1, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1);
            assert.equal(path[0], 0);
            assert.equal(path[1], 2);
            assert.equal(path[2].length, 2);
            assert.equal(path[2][0].toString().substring(2), node1);
            assert.equal(path[2][1].toString(), treeNodes[5]);

            assert.equal(path[3].length, 2);
            assert.equal(path[3][0], true);
            assert.equal(path[3][1], false);

            let calculatedRoot = calculateWithPath(node2, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(2);
            assert.equal(path[0], 0);
            assert.equal(path[1], 2);
            assert.equal(path[2].length, 2);
            assert.equal(path[2][0].toString().substring(2), node3);
            assert.equal(path[2][1].toString(), treeNodes[4]);

            assert.equal(path[3].length, 2);
            assert.equal(path[3][0], false);
            assert.equal(path[3][1], true);

            let calculatedRoot = calculateWithPath(node3, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }
    });

    it("RecordReceipts with 4 receipts", async () => {
        await this.token.approve(this.locker.address, '1000000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA', {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB', {from: owner});
        await this.locker.createReceipt('300000', 'CCCCCCCCC', {from: owner});
        await this.locker.createReceipt('400000', 'DDDDDDDDD', {from: owner});

        await this.merkle.recordReceipts({from: owner});

        assert.equal(await this.merkle.merkleTreeCount.call(), 1);
        let tree = await this.merkle.getMerkleTree.call(0);
        assert.equal(tree[1].toString(), '0'); // first receipt id
        assert.equal(tree[2], 4); // receipt count
        assert.equal(tree[3], 7); // tree size
        assert.equal(tree[4].length, 7); //tree node length

        let treeNodes = tree[4];
        assert.equal(tree[0], treeNodes[6]);

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);
        let node3 = calculateNodeHash(300000, 'CCCCCCCCC', 2);
        let node4 = calculateNodeHash(400000, 'DDDDDDDDD', 3);

        assert.equal(node1, treeNodes[0].substring(2));
        assert.equal(node2, treeNodes[1].substring(2));
        assert.equal(node3, treeNodes[2].substring(2));
        assert.equal(node4, treeNodes[3].substring(2));

        {
            let path = await this.merkle.generateMerklePath.call(0);
            assert.equal(path[0], 0); //tree index
            assert.equal(path[1], 2); // path length
            assert.equal(path[2].length, 2);
            assert.equal(path[2][0].toString().substring(2), node2);
            assert.equal(path[2][1].toString(), treeNodes[5]);

            assert.equal(path[3].length, 2);
            assert.equal(path[3][0], false);
            assert.equal(path[3][1], false);

            let calculatedRoot = calculateWithPath(node1, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1);
            assert.equal(path[0], 0);
            assert.equal(path[1], 2);
            assert.equal(path[2].length, 2);
            assert.equal(path[2][0].toString().substring(2), node1);
            assert.equal(path[2][1].toString(), treeNodes[5]);

            assert.equal(path[3].length, 2);
            assert.equal(path[3][0], true);
            assert.equal(path[3][1], false);

            let calculatedRoot = calculateWithPath(node2, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(2);
            assert.equal(path[0], 0);
            assert.equal(path[1], 2);
            assert.equal(path[2].length, 2);
            assert.equal(path[2][0].toString().substring(2), node4);
            assert.equal(path[2][1].toString(), treeNodes[4]);

            assert.equal(path[3].length, 2);
            assert.equal(path[3][0], false);
            assert.equal(path[3][1], true);

            let calculatedRoot = calculateWithPath(node3, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(3);
            assert.equal(path[0], 0);
            assert.equal(path[1], 2);
            assert.equal(path[2].length, 2);
            assert.equal(path[2][0].toString().substring(2), node3);
            assert.equal(path[2][1].toString(), treeNodes[4]);

            assert.equal(path[3].length, 2);
            assert.equal(path[3][0], true);
            assert.equal(path[3][1], true);

            let calculatedRoot = calculateWithPath(node4, path[2], path[3]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }
    });

    // it("RecordReceipts with 65 receipt", async () => {
    //     await this.token.approve(this.locker.address, '100000000', {from: owner});
    //
    //     for (let i = 0; i < 65; i++) {
    //         await this.locker.createReceipt((i + 1).toString(), 'AAAAAAAAA', {from: owner});
    //     }
    //     await this.merkle.recordReceipts({from: owner});
    //
    //     assert.equal(await this.merkle.merkleTreeCount.call(), 1);
    //     let tree = await this.merkle.getMerkleTree.call(0);
    //     assert.equal(tree[1].toString(), '0'); // first receipt id
    //     assert.equal(tree[2], 65); // receipt count
    //     assert.equal(tree[3], 141); // tree size
    //
    //     let treeNodes = tree[4];
    //     // assert.equal(tree[0], treeNodes[126]);
    //
    //     for (let i = 0; i < 65; i++) {
    //         console.log(i);
    //         let hashResult = calculateNodeHash(i+1, 'AAAAAAAAA', i);
    //         assert.equal(hashResult, treeNodes[i].substring(2));
    //
    //         let path = await this.merkle.generateMerklePath.call(i);
    //         assert.equal(path[0], 0);  // tree index
    //         console.log('path :', path[2].length);
    //         assert.equal(path[1], 7); //
    //
    //         assert.equal(path[2].length, 7);
    //
    //         assert.equal(path[3].length, 7);
    //
    //         let calculatedRoot = calculateWithPath(hashResult, path[2], path[3]);
    //         assert.equal(calculatedRoot, tree[0].substring(2));
    //     }
    // });

    // it("RecordReceipts with 128 receipt", async () => {
    //     await this.token.approve(this.locker.address, '100000000', {from: owner});
    //
    //     for (let i = 0; i < 128; i++) {
    //         await this.locker.createReceipt((i + 1).toString(), 'AAAAAAAAA', {from: owner});
    //     }
    //     await this.merkle.recordReceipts({from: owner});
    //
    //     assert.equal(await this.merkle.merkleTreeCount.call(), 1);
    //     let tree = await this.merkle.getMerkleTree.call(0);
    //     assert.equal(tree[1].toString(), '0'); // first receipt id
    //     assert.equal(tree[2], 128); // receipt count
    //     assert.equal(tree[3], 255); // tree size
    //
    //     let treeNodes = tree[4];
    //     assert.equal(tree[0], treeNodes[254]);
    //
    //     let indexAry = [0,1,2,3,6,7,8,63,64,127];
    //
    //     for (let i = 0; i < indexAry.length; i++) {
    //         let index = indexAry[i];
    //         let hashResult = calculateNodeHash(index + 1, 'AAAAAAAAA', index);
    //         assert.equal(hashResult, treeNodes[index].substring(2));
    //
    //         let path = await this.merkle.generateMerklePath.call(index);
    //         assert.equal(path[0], 0);
    //
    //         assert.equal(path[1], 7);
    //
    //         assert.equal(path[2].length, 7);
    //
    //         assert.equal(path[3].length, 7);
    //
    //         let calculatedRoot = calculateWithPath(hashResult, path[2], path[3]);
    //         assert.equal(calculatedRoot, tree[0].substring(2));
    //     }
    // });

});