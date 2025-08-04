import { sendSlackMessage } from "./actions/slack";
import { ERROR_DELAY_SEC } from "./settings";


export async function sendError(description: string): Promise<void> {
    console.log(`[ERROR] ${description}`);
    await sendSlackMessage(`⛔️ Error: ${description}. Retrying in ${ERROR_DELAY_SEC} seconds...`);
}

export async function tryAction<T>(action: () => Promise<T>, actionDescription: string, tryNumber: number = 0): Promise<T> {
    try {
        console.log(`[ACTION] ${actionDescription}...`);
        return await action();
    } catch (error: any) {
        console.log(`[ERROR] ${actionDescription} failed:`, error.message || error);

        if (tryNumber >= ERROR_DELAY_SEC.length - 1) {
            console.error(`[ERROR] Max retries reached for action: ${actionDescription}. Skipping.`);
            await sendError(`⛔️ Max retries reached for action: ${actionDescription}`);
            throw new Error(`Max retries reached for action: ${actionDescription}`);
        }

        const delay = ERROR_DELAY_SEC[tryNumber];
        sendSlackMessage(`⛔️ ${actionDescription}: \`${error.message || error}\`. Retrying in ${delay} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000)); // Retry delay
        return tryAction(action, actionDescription, tryNumber + 1);
    }
}