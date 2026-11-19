import { databaseStorage } from './databaseStorage';

export const storage = {
  get: databaseStorage.getItem,
  set: databaseStorage.setItem,
  remove: databaseStorage.removeItem,
};
