import { setupMockEnvironment } from "./server";
import { getStorageName } from "./utils/getStorageName";

var storageName = getStorageName('redis')
setupMockEnvironment(storageName)