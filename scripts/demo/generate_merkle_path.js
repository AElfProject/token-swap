const Merkle = artifacts.require('MerkleTreeGenerator');
const merkleAddress = '0x67a7679f27eB424883452DE1496265Cb9D61c57c';

module.exports = async function () {
    this.merkle = await Merkle.at(merkleAddress);
    let receiptid = 0;
    let path = await this.merkle.generateMerklePath.call(receiptid);
}
