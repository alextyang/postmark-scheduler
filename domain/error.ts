import { sendSlackMessage } from "./actions/slack";
import { ERROR_DELAY_SEC, TAG_USER } from "./settings";


export async function sendError(description: string): Promise<void> {
    console.log(`[ERROR] ${description}`);
    await sendSlackMessage(`${TAG_USER} Error: ${description}\nRetrying in ${ERROR_DELAY_SEC} seconds...`);
}

export async function tryAction<T>(action: () => Promise<T>, actionDescription: string, tryNumber: number = 0): Promise<T> {
    try {
        console.log(`[ACTION] ${actionDescription}...`);
        return await action();
    } catch (error: any) {
        console.log(`[ERROR] ${actionDescription} failed:`, error.message || error);
        const delay = ERROR_DELAY_SEC.length <= tryNumber ? ERROR_DELAY_SEC[ERROR_DELAY_SEC.length - 1] : ERROR_DELAY_SEC[tryNumber];
        sendSlackMessage(`${TAG_USER} Error during ${actionDescription}: ${error.message || error}\nRetrying in ${delay} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000)); // Retry delay
        return tryAction(action, actionDescription, tryNumber + 1);
    }
}