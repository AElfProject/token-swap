const {expectRevert} = require('@openzeppelin/test-helpers');
const LOCK = artifacts.require('LockMapping');
const TOKEN = artifacts.require('MockToken');
const MERKLE = artifacts.require('MerkleTreeGenerator');
var crypto = require('crypto');
const truffleAssert = require('truffle-assertions');


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
        this.locker = await LOCK.new(this.token.address, 10, {from: owner});
        this.merkle = await MERKLE.new(this.locker.address, 4, {from: owner});
    });

    it("constructor", async () => {
        assert.equal(await this.merkle.receiptProviderAddress.call(), this.locker.address);
        assert.equal(await this.merkle.MerkleTreeMaximalLeafCount.call(), 16);
    });

    it("change receipt provider", async () => {
        await expectRevert(this.merkle.changeReceiptMaker(owner, {from:accounts[1]}), "Ownable: caller is not the owner");
        await this.merkle.changeReceiptMaker(owner, {from:owner});
        assert.equal(await this.merkle.receiptProviderAddress.call(), owner);
    });

    it("change path length limit", async () => {
        await expectRevert(this.merkle.changePathLengthLimit(10, {from:accounts[1]}), "Ownable: caller is not the owner");
        await expectRevert(this.merkle.changePathLengthLimit(11, {from:owner}), "Exceeding Maximal Path Length.");
        await this.merkle.changePathLengthLimit(10, {from:owner});
        assert.equal(await this.merkle.MerkleTreeMaximalLeafCount.call(), 1024);
    });


    it("getArbitraryMerkleTree arbitrary with 1 receipt", async () => {
        await this.token.approve(this.locker.address, '100000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA',  '', {from: owner});

        let tree = await this.merkle.getArbitraryMerkleTree.call(0, 0);
        assert.equal(tree[1].toString(), '0'); // first receipt id
        assert.equal(tree[2].toString(), '1'); // receipt count
        assert.equal(tree[3].toString(), '3'); // tree size
        assert.equal(tree[4].length, 3); //tree node length

        let treeNodes = tree[4];
        assert.equal(tree[0], treeNodes[2]);

        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 0);
        assert.equal(treeRoot, tree[0])

        let hashResult = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        assert.equal(hashResult, treeNodes[0].substring(2));

        let path = await this.merkle.generateMerklePath.call(0, 0, 0);

        assert.equal(path[0], 1);

        assert.equal(path[1].length, 1);
        assert.equal(path[1][0].toString().substring(2), hashResult);

        assert.equal(path[2].length, 1);
        assert.equal(path[2][0], false);

        let calculatedRoot = calculateWithPath(hashResult, path[1], path[2]);
        assert.equal(calculatedRoot, tree[0].substring(2));
    });

    it("getMerkleTree with 1 receipt", async () => {
        await this.token.approve(this.locker.address, '100000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA',  '', {from: owner});

        let tree = await this.merkle.getMerkleTree.call(1);
        assert.equal(tree[0], 0); // tree index
        assert.equal(tree[2].toString(), '0'); // first receipt id
        assert.equal(tree[3].toString(), '1'); // receipt count
        assert.equal(tree[4].toString(), '3'); // tree size

        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 0);
        assert.equal(treeRoot, tree[1])

        let hashResult = calculateNodeHash(100000, 'AAAAAAAAA', 0);

        let path = await this.merkle.generateMerklePath.call(0, 0, 0);

        assert.equal(path[0], 1);

        assert.equal(path[1].length, 1);
        assert.equal(path[1][0].toString().substring(2), hashResult);

        assert.equal(path[2].length, 1);
        assert.equal(path[2][0], false);

        let calculatedRoot = calculateWithPath(hashResult, path[1], path[2]);
        assert.equal(calculatedRoot, tree[1].substring(2));
    });

    it("getArbitraryMerkleTree with 2 receipts", async () => {
        await this.token.approve(this.locker.address, '300000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA',  '', {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB',  '', {from: owner});


        let tree = await this.merkle.getArbitraryMerkleTree.call(0, 1);
        assert.equal(tree[1].toString(), '0'); // first receipt id
        assert.equal(tree[2], 2); // receipt count
        assert.equal(tree[3], 3); // tree size
        assert.equal(tree[4].length, 3); //tree node length

        let treeNodes = tree[4];
        assert.equal(tree[0], treeNodes[2]);
        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 1);
        assert.equal(treeRoot, tree[0])

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);
        assert.equal(node1, treeNodes[0].substring(2));
        assert.equal(node2, treeNodes[1].substring(2));

        {
            let path = await this.merkle.generateMerklePath.call(0, 0, 1);
            assert.equal(path[0], 1);
            assert.equal(path[1].length, 1);
            assert.equal(path[1][0].toString().substring(2), node2);

            assert.equal(path[2].length, 1);
            assert.equal(path[2][0], false);

            let calculatedRoot = calculateWithPath(node1, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1, 0, 1);
            assert.equal(path[0], 1);
            assert.equal(path[1].length, 1);
            assert.equal(path[1][0].toString().substring(2), node1);

            assert.equal(path[2].length, 1);
            assert.equal(path[2][0], true);

            let calculatedRoot = calculateWithPath(node2, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }
    });

    it("getMerkleTree with 2 receipts", async () => {
        await this.token.approve(this.locker.address, '300000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA',  '', {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB',  '', {from: owner});


        let tree = await this.merkle.getMerkleTree.call(2);
        assert.equal(tree[0], 0); // tree index
        assert.equal(tree[2].toString(), '0'); // first receipt id
        assert.equal(tree[3], 2); // receipt count
        assert.equal(tree[4], 3); // tree size

        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 1);
        assert.equal(treeRoot, tree[1])

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);

        {
            let path = await this.merkle.generateMerklePath.call(0, 0, 1);
            assert.equal(path[0], 1);
            assert.equal(path[1].length, 1);
            assert.equal(path[1][0].toString().substring(2), node2);

            assert.equal(path[2].length, 1);
            assert.equal(path[2][0], false);

            let calculatedRoot = calculateWithPath(node1, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1, 0, 1);
            assert.equal(path[0], 1);
            assert.equal(path[1].length, 1);
            assert.equal(path[1][0].toString().substring(2), node1);

            assert.equal(path[2].length, 1);
            assert.equal(path[2][0], true);

            let calculatedRoot = calculateWithPath(node2, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }
    });


    it("getArbitraryMerkleTree with 3 receipts", async () => {
        await this.token.approve(this.locker.address, '600000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA',  '', {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB',  '', {from: owner});
        await this.locker.createReceipt('300000', 'CCCCCCCCC',  '', {from: owner});


        let tree = await this.merkle.getArbitraryMerkleTree.call(0, 2);
        assert.equal(tree[1].toString(), '0'); // first receipt id
        assert.equal(tree[2], 3); // receipt count
        assert.equal(tree[3], 7); // tree size
        assert.equal(tree[4].length, 7); //tree node length

        let treeNodes = tree[4];
        assert.equal(tree[0], treeNodes[6]);

        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 2);
        assert.equal(treeRoot, tree[0])

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);
        let node3 = calculateNodeHash(300000, 'CCCCCCCCC', 2);

        assert.equal(node1, treeNodes[0].substring(2));
        assert.equal(node2, treeNodes[1].substring(2));
        assert.equal(node3, treeNodes[2].substring(2));

        {
            let path = await this.merkle.generateMerklePath.call(0, 0, 2);
            assert.equal(path[0], 2); // path length
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node2);
            assert.equal(path[1][1].toString(), treeNodes[5]);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], false);
            assert.equal(path[2][1], false);

            let calculatedRoot = calculateWithPath(node1, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1, 0, 2);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node1);
            assert.equal(path[1][1].toString(), treeNodes[5]);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], true);
            assert.equal(path[2][1], false);

            let calculatedRoot = calculateWithPath(node2, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(2, 0, 2);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node3);
            assert.equal(path[1][1].toString(), treeNodes[4]);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], false);
            assert.equal(path[2][1], true);

            let calculatedRoot = calculateWithPath(node3, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }
    });


    it("getMerkleTree with 3 receipts", async () => {
        await this.token.approve(this.locker.address, '600000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA',  '', {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB',  '', {from: owner});
        await this.locker.createReceipt('300000', 'CCCCCCCCC',  '', {from: owner});


        let tree = await this.merkle.getMerkleTree.call(3);
        assert.equal(tree[0], 0); // tree index
        assert.equal(tree[2].toString(), '0'); // first receipt id
        assert.equal(tree[3], 3); // receipt count
        assert.equal(tree[4], 7); // tree size


        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 2);
        assert.equal(treeRoot, tree[1])

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);
        let node3 = calculateNodeHash(300000, 'CCCCCCCCC', 2);


        {
            let path = await this.merkle.generateMerklePath.call(0, 0, 2);
            assert.equal(path[0], 2); // path length
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node2);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], false);
            assert.equal(path[2][1], false);

            let calculatedRoot = calculateWithPath(node1, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1, 0, 2);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node1);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], true);
            assert.equal(path[2][1], false);

            let calculatedRoot = calculateWithPath(node2, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(2, 0, 2);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node3);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], false);
            assert.equal(path[2][1], true);

            let calculatedRoot = calculateWithPath(node3, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }
    });


    it("getArbitraryMerkleTree with 4 receipts", async () => {
        await this.token.approve(this.locker.address, '1000000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA', '',  {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB',  '', {from: owner});
        await this.locker.createReceipt('300000', 'CCCCCCCCC',  '', {from: owner});
        await this.locker.createReceipt('400000', 'DDDDDDDDD', '',  {from: owner});


        let tree = await this.merkle.getArbitraryMerkleTree.call(0, 3);
        assert.equal(tree[2], 4); // receipt count
        assert.equal(tree[3], 7); // tree size
        assert.equal(tree[4].length, 7); //tree node length

        let treeNodes = tree[4];
        assert.equal(tree[0], treeNodes[6]);

        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 3);
        assert.equal(treeRoot, tree[0]);

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);
        let node3 = calculateNodeHash(300000, 'CCCCCCCCC', 2);
        let node4 = calculateNodeHash(400000, 'DDDDDDDDD', 3);

        assert.equal(node1, treeNodes[0].substring(2));
        assert.equal(node2, treeNodes[1].substring(2));
        assert.equal(node3, treeNodes[2].substring(2));
        assert.equal(node4, treeNodes[3].substring(2));

        {
            let path = await this.merkle.generateMerklePath.call(0, 0, 3);
            assert.equal(path[0], 2); // path length
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node2);
            assert.equal(path[1][1].toString(), treeNodes[5]);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], false);
            assert.equal(path[2][1], false);

            let calculatedRoot = calculateWithPath(node1, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1, 0, 3);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node1);
            assert.equal(path[1][1].toString(), treeNodes[5]);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], true);
            assert.equal(path[2][1], false);

            let calculatedRoot = calculateWithPath(node2, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(2, 0, 3);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node4);
            assert.equal(path[1][1].toString(), treeNodes[4]);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], false);
            assert.equal(path[2][1], true);

            let calculatedRoot = calculateWithPath(node3, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(3, 0, 3);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node3);
            assert.equal(path[1][1].toString(), treeNodes[4]);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], true);
            assert.equal(path[2][1], true);

            let calculatedRoot = calculateWithPath(node4, path[1], path[2]);
            assert.equal(calculatedRoot, tree[0].substring(2));
        }
    });


    it("getMerkleTree with 4 receipts", async () => {
        await this.token.approve(this.locker.address, '1000000', {from: owner});
        await this.locker.createReceipt('100000', 'AAAAAAAAA', '',  {from: owner});
        await this.locker.createReceipt('200000', 'BBBBBBBBB',  '', {from: owner});
        await this.locker.createReceipt('300000', 'CCCCCCCCC',  '', {from: owner});
        await this.locker.createReceipt('400000', 'DDDDDDDDD', '',  {from: owner});


        let tree = await this.merkle.getMerkleTree.call(4);
        assert.equal(tree[0], 0); // tree index
        assert.equal(tree[2].toString(), '0'); // first receipt id
        assert.equal(tree[3], 4); // receipt count
        assert.equal(tree[4], 7); // tree size


        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 3);
        assert.equal(treeRoot, tree[1]);

        let node1 = calculateNodeHash(100000, 'AAAAAAAAA', 0);
        let node2 = calculateNodeHash(200000, 'BBBBBBBBB', 1);
        let node3 = calculateNodeHash(300000, 'CCCCCCCCC', 2);
        let node4 = calculateNodeHash(400000, 'DDDDDDDDD', 3);

        {
            let path = await this.merkle.generateMerklePath.call(0, 0, 3);
            assert.equal(path[0], 2); // path length
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node2);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], false);
            assert.equal(path[2][1], false);

            let calculatedRoot = calculateWithPath(node1, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(1, 0, 3);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node1);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], true);
            assert.equal(path[2][1], false);

            let calculatedRoot = calculateWithPath(node2, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(2, 0, 3);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node4);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], false);
            assert.equal(path[2][1], true);

            let calculatedRoot = calculateWithPath(node3, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }

        {
            let path = await this.merkle.generateMerklePath.call(3, 0, 3);
            assert.equal(path[0], 2);
            assert.equal(path[1].length, 2);
            assert.equal(path[1][0].toString().substring(2), node3);

            assert.equal(path[2].length, 2);
            assert.equal(path[2][0], true);
            assert.equal(path[2][1], true);

            let calculatedRoot = calculateWithPath(node4, path[1], path[2]);
            assert.equal(calculatedRoot, tree[1].substring(2));
        }
    });

    it("15 receipts", async () => {
        await this.token.approve(this.locker.address, '1000000', {from: owner});
        for (let i =0; i < 15; i++) {
            await this.locker.createReceipt(i.toString(), 'AAAAAAAAA', '', {from: owner});
        }

        let arbitraryTree = await this.merkle.getArbitraryMerkleTree.call(0, 14);
        assert.equal(arbitraryTree[1], 0); // first receipt id
        assert.equal(arbitraryTree[2], 15); // receipt count
        assert.equal(arbitraryTree[3], 31); // tree size
        assert.equal(arbitraryTree[4].length, 31); //tree node length

        let treeNodes = arbitraryTree[4];
        assert.equal(arbitraryTree[0], treeNodes[30]);

        let tree15_15 = await this.merkle.getMerkleTree.call(15);
        assert.equal(tree15_15[0], 0); // tree index
        assert.equal(tree15_15[1], arbitraryTree[0]); // tree root
        assert.equal(tree15_15[2], 0); // first receipt id
        assert.equal(tree15_15[3], 15); // receipt count
        assert.equal(tree15_15[4], 31); // tree size

        let tree16_15 = await this.merkle.getMerkleTree.call(16);
        assert.equal(tree16_15[0], 0); // tree index
        assert.equal(tree16_15[1], arbitraryTree[0]); // tree root
        assert.equal(tree16_15[2], 0); // first receipt id
        assert.equal(tree16_15[3], 15); // receipt count
        assert.equal(tree16_15[4], 31); // tree size


        let treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 14);
        assert.equal(treeRoot, arbitraryTree[0]);
        assert.equal(treeRoot, tree15_15[1]);

        for (let i = 0; i < 15; i++) {
            let node = calculateNodeHash(i, 'AAAAAAAAA', i);
            assert.equal(node, treeNodes[i].substring(2));
            let path = await this.merkle.generateMerklePath.call(i, 0, 14);
            let calculatedRoot = calculateWithPath(node, path[1], path[2]);
            assert.equal(calculatedRoot, arbitraryTree[0].substring(2));
        }

        // 16th receipt
        await this.locker.createReceipt('15', 'AAAAAAAAA', '', {from: owner});

        arbitraryTree = await this.merkle.getArbitraryMerkleTree.call(0, 15);
        assert.equal(arbitraryTree[1], 0); // first receipt id
        assert.equal(arbitraryTree[2], 16); // receipt count
        assert.equal(arbitraryTree[3], 31); // tree size
        assert.equal(arbitraryTree[4].length, 31); //tree node length

        let treeNodes_16 = arbitraryTree[4];
        assert.equal(arbitraryTree[0], treeNodes_16[30]);

        let tree15_16 = await this.merkle.getMerkleTree.call(15);
        assert.equal(tree15_16[0], 0); // tree index
        assert.equal(tree15_16[1], tree15_15[1]); // tree root
        assert.equal(tree15_16[2], 0); // first receipt id
        assert.equal(tree15_16[3], 15); // receipt count
        assert.equal(tree15_16[4], 31); // tree size

        let tree16_16 = await this.merkle.getMerkleTree.call(16);
        assert.equal(tree16_16[0], 0); // tree index
        assert.equal(tree16_16[1], arbitraryTree[0]); // tree root
        assert.equal(tree16_16[2], 0); // first receipt id
        assert.equal(tree16_16[3], 16); // receipt count
        assert.equal(tree16_16[4], 31); // tree size

        await expectRevert.unspecified(this.merkle.getMerkleTree.call(17));

        treeRoot = await this.merkle.getMerkleTreeRoot.call(0, 15);
        assert.equal(treeRoot, arbitraryTree[0]);
        assert.equal(treeRoot, tree16_16[1]);

        for (let i = 0; i < 16; i++) {
            let node = calculateNodeHash(i, 'AAAAAAAAA', i);
            assert.equal(node, treeNodes_16[i].substring(2));
            let path = await this.merkle.generateMerklePath.call(i, 0, 15);
            let calculatedRoot = calculateWithPath(node, path[1], path[2]);
            assert.equal(calculatedRoot, arbitraryTree[0].substring(2));
        }

        // 17th receipt
        await this.locker.createReceipt('16', 'AAAAAAAAA', '', {from: owner});

        arbitraryTree = await this.merkle.getArbitraryMerkleTree.call(16, 16);
        assert.equal(arbitraryTree[1], 16); // first receipt id
        assert.equal(arbitraryTree[2], 1); // receipt count
        assert.equal(arbitraryTree[3], 3); // tree size
        assert.equal(arbitraryTree[4].length, 3); //tree node length

        let treeNodes_17 = arbitraryTree[4];
        assert.equal(arbitraryTree[0], treeNodes_17[2]);

        let tree15_17 = await this.merkle.getMerkleTree.call(15);
        assert.equal(tree15_17[0], 0); // tree index
        assert.equal(tree15_17[1], tree15_15[1]); // tree root
        assert.equal(tree15_17[2], 0); // first receipt id
        assert.equal(tree15_17[3], 15); // receipt count
        assert.equal(tree15_17[4], 31); // tree size

        let tree16_17 = await this.merkle.getMerkleTree.call(16);
        assert.equal(tree16_17[0], 0); // tree index
        assert.equal(tree16_17[1], tree16_16[1]); // tree root
        assert.equal(tree16_17[2], 0); // first receipt id
        assert.equal(tree16_17[3], 16); // receipt count
        assert.equal(tree16_17[4], 31); // tree size

        let tree17_17 = await this.merkle.getMerkleTree.call(17);
        assert.equal(tree17_17[0], 1); // tree index
        assert.equal(tree17_17[1], arbitraryTree[0]); // tree root
        assert.equal(tree17_17[2], 16); // first receipt id
        assert.equal(tree17_17[3], 1); // receipt count
        assert.equal(tree17_17[4], 3); // tree size


        treeRoot = await this.merkle.getMerkleTreeRoot.call(16, 16);
        assert.equal(treeRoot, arbitraryTree[0]);
        assert.equal(treeRoot, tree17_17[1]);

        for (let i = 0; i < 17; i++) {
            let node = calculateNodeHash(i, 'AAAAAAAAA', i);
            if (i === 16)
                assert.equal(node, treeNodes_17[0].substring(2));
            else
                assert.equal(node, treeNodes_16[i].substring(2));

            if (i === 16) {
                let path = await this.merkle.generateMerklePath.call(i, 16, 16);
                let calculatedRoot = calculateWithPath(node, path[1], path[2]);
                assert.equal(calculatedRoot, tree17_17[1].substring(2));
            }
            else {
                let path = await this.merkle.generateMerklePath.call(i, 0, 15);
                let calculatedRoot = calculateWithPath(node, path[1], path[2]);
                assert.equal(calculatedRoot, tree16_16[1].substring(2));
            }
        }
    });

});