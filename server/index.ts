import { startServer } from "./server";
import { getStorageName } from "./utils/getStorageName";

var storageName = getStorageName('redis')
startServer(storageName)