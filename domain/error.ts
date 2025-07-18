import { sendSlackMessage } from "./actions/slack";
import { ERROR_DELAY_SEC, TAG_USER } from "./settings";


export async function sendError(description: string): Promise<void> {
    console.log(`[ERROR] ${description}`);
    await sendSlackMessage(`${TAG_USER} Error: ${description}\nRetrying in ${ERROR_DELAY_SEC} seconds...`);
}

export async function tryAction<T>(action: () => Promise<T>, actionDescription: string): Promise<T> {
    try {
        console.log(`[ACTION] ${actionDescription}...`);
        return await action();
    } catch (error: any) {
        console.log(`[ERROR] ${actionDescription} failed:`, error.message || error);
        sendSlackMessage(`${TAG_USER} Error during ${actionDescription}: ${error.message || error}\nRetrying in ${ERROR_DELAY_SEC} seconds...`);
        await new Promise(resolve => setTimeout(resolve, ERROR_DELAY_SEC * 1000)); // Retry delay
        return tryAction(action, actionDescription);
    }
}