import { StatusBarItem, window, workspace, StatusBarAlignment } from "vscode";

export const searchToEndCommandID = "shadowReader.searchToEnd";
let myStatusBarItem: StatusBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    10000
);
myStatusBarItem.command = searchToEndCommandID;

const defaultBossText = "Hello world";
let lastReadText = '';
let showingText = '';
let timeoutInternal: NodeJS.Timeout | null = null;

// 实际设置状态栏
function _setStatusBar(msg: string) {
    if (msg.length > 0) {
        myStatusBarItem.text = msg;
        showingText = msg;
        myStatusBarItem.show();
    } else {
        myStatusBarItem.hide();
    }
}

// 显示老板信息
function showBossText() {
    _setStatusBar(defaultBossText);
}

// 切换回正常信息
function showNormalText() {
    _setStatusBar(lastReadText);
    if (timeoutInternal) {
        clearTimeout(timeoutInternal);
    }
    let timeoutSecond = (<number>workspace.getConfiguration().get("shadowReader.hiddenTime")) * 1000;
    timeoutInternal = setTimeout(showBossText, timeoutSecond);
}

export function toggleBossMsg() {
    // 已经显示老板信息
    if (showingText === defaultBossText) {
        showNormalText();
    } else {
        showBossText();
    }
}

export function setStatusBarMsg(msg: string) {
    lastReadText = msg;
    showNormalText();
}
