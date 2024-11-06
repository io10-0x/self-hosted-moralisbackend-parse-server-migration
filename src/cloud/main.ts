/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
declare const Parse: any;
import './generated/evmApi';
import './generated/solApi';
import { requestMessage } from '../auth/authService';
import { ethers } from 'ethers';

Parse.Cloud.define('requestMessage', async ({ params }: any) => {
  const { address, chain, networkType } = params;

  const message = await requestMessage({
    address,
    chain,
    networkType,
  });

  return { message };
});

Parse.Cloud.define('getPluginSpecs', () => {
  // Not implemented, only excists to remove client-side errors when using the moralis-v1 package
  return [];
});
Parse.Cloud.define('getServerTime', () => {
  // Not implemented, only excists to remove client-side errors when using the moralis-v1 package
  return null;
});
Parse.Cloud.define('watchContractEvent', async ({ params }: { params: any }) => {
  let provider;
  if (params['chainId'] == 1337) {
    provider = new ethers.WebSocketProvider('http://127.0.0.1:8545/');
  } else {
    provider = new ethers.WebSocketProvider(process.env.SEPOLIA_RPC_URL!);
  }
  const contractAddress = params['address'];
  const contract = new ethers.Contract(contractAddress, [params['abi']], provider);

  if (params['tableName'] == 'ItemBought') {
    contract.on('ItemBought', (tokenid, price, owner, previousowner, nftAddress) => {
      const ItemBought = Parse.Object.extend('ItemBought');
      const itemBought = new ItemBought();
      itemBought.set('tokenId', tokenid.toString());
      itemBought.set('price', price.toString());
      itemBought.set('buyer', owner);
      itemBought.set('seller', previousowner);
      itemBought.set('nftAddress', nftAddress);
      itemBought.save();
    });
    return { success: true };
  }
  if (params['tableName'] == 'ItemListed') {
    contract.on('ItemListed', (tokenId, price, owner, nftAddress) => {
      const ItemListed = Parse.Object.extend('ItemListed');
      const itemListed = new ItemListed();
      itemListed.set('tokenId', tokenId.toString());
      itemListed.set('price', price.toString());
      itemListed.set('seller', owner);
      itemListed.set('nftAddress', nftAddress);
      itemListed.save();
    });
    return { success: true };
  }

  if (params['tableName'] == 'ItemUpdated') {
    contract.on('ItemUpdated', (owner, nftAddress, tokenId, price) => {
      const ItemUpdated = Parse.Object.extend('ItemUpdated');
      const itemUpdated = new ItemUpdated();
      itemUpdated.set('tokenId', tokenId.toString());
      itemUpdated.set('price', price.toString());
      itemUpdated.set('seller', owner);
      itemUpdated.set('nftAddress', nftAddress);
      itemUpdated.save();
    });
    return { success: true };
  }
  if (params['tableName'] == 'ItemUnlisted') {
    contract.on('ItemUnlisted', (owner, nftAddress, tokenId) => {
      const ItemUnlisted = Parse.Object.extend('ItemUnlisted');
      const itemUnlisted = new ItemUnlisted();
      itemUnlisted.set('seller', owner);
      itemUnlisted.set('nftAddress', nftAddress);
      itemUnlisted.set('tokenId', tokenId.toString());
      itemUnlisted.save();
    });
    return { success: true };
  }
  return { success: false };
});

Parse.Cloud.afterSave('ItemListed', async function (request: any) {
  let logger = request.log;
  logger.info('Aftersave trigger confirmed');
  const Recentlylistedtable = Parse.Object.extend('Recentlylistedtable'); //set up a query to check if the item already has been listed, if it hasnt, then add to db, if it has, do nothing
  const recentlylistedtable = new Recentlylistedtable();
  recentlylistedtable.set('tokenId', request.object.get('tokenId'));
  recentlylistedtable.set('price', request.object.get('price'));
  recentlylistedtable.set('seller', request.object.get('seller'));
  recentlylistedtable.set('nftAddress', request.object.get('nftAddress'));
  logger.info('Saving ....');
  recentlylistedtable.save();
  logger.info('Saved to mongodb database');
});

Parse.Cloud.afterSave('ItemUnlisted', async function (request: any) {
  let logger = request.log;
  logger.info('ItemUnlisted Aftersave trigger confirmed');
  const Recentlylistedtable = Parse.Object.extend('Recentlylistedtable');
  const query = new Parse.Query(Recentlylistedtable);
  logger.info('Searching for object to delete');
  query.equalTo('tokenId', request.object.get('tokenId'));
  query.equalTo('nftAddress', request.object.get('nftAddress'));
  const object = await query.first();
  logger.info(
    `Deleting ${object} at ${request.object.get('nftAddress')} with tokenid ${request.object.get('tokenId')}`,
  );
  if (object) {
    await object.destroy();
  } else {
    logger.info('Object doesnt exist in database. Cannot be cancelled');
  }
});

Parse.Cloud.afterSave('ItemBought', async function (request: any) {
  let logger = request.log;
  logger.info('ItemBought Aftersave trigger confirmed');
  const Recentlylistedtable = Parse.Object.extend('Recentlylistedtable');
  const query = new Parse.Query(Recentlylistedtable);
  logger.info('Searching for object to delete');
  query.equalTo('tokenId', request.object.get('tokenId'));
  query.equalTo('nftAddress', request.object.get('nftAddress'));
  const object = await query.first();
  logger.info(
    `Deleting ${object} at ${request.object.get('nftAddress')} with tokenid ${request.object.get(
      'tokenId',
    )} as it has just been bought`,
  );
  if (object) {
    await object.destroy();
  } else {
    logger.info('Object doesnt exist in database. Cannot be bought');
  }
});

Parse.Cloud.afterSave('ItemUpdated', async function (request: any) {
  let logger = request.log;
  logger.info('ItemUpdated Aftersave trigger confirmed');
  const Recentlylistedtable = Parse.Object.extend('Recentlylistedtable');
  const query = new Parse.Query(Recentlylistedtable);
  logger.info('Searching for object to delete');
  query.equalTo('tokenId', request.object.get('tokenId'));
  query.equalTo('nftAddress', request.object.get('nftAddress'));
  const object = await query.first();
  logger.info(
    `Deleting ${object} at ${request.object.get('nftAddress')} with tokenid ${request.object.get(
      'tokenId',
    )} as it has just been updated`,
  );
  if (object) {
    await object.destroy();
  } else {
    logger.info('Object doesnt exist in database. Cannot be updated');
  }
  const recentlylistedtable = new Recentlylistedtable();
  recentlylistedtable.set('tokenId', request.object.get('tokenId'));
  recentlylistedtable.set('price', request.object.get('price'));
  recentlylistedtable.set('seller', request.object.get('seller'));
  recentlylistedtable.set('nftAddress', request.object.get('nftAddress'));
  logger.info('Saving ....');
  recentlylistedtable.save();
  logger.info('Saved to mongodb database');
});
