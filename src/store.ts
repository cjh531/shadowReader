import { existsSync, mkdirSync, createReadStream, createWriteStream, copyFileSync, unlink } from "fs";
import { ExtensionContext, window } from "vscode";
import chardet = require('chardet');
import iconv = require('iconv-lite');
import path = require('path');
import stream = require('stream');
import got from "got";
import { promisify } from 'util';

export const bookLibraryKey = "bookList";
const tmpFileName = "tmp";
const pipeline = promisify(stream.pipeline);

// check target file is decode == utf8 or not
// if decode != UTF-16 LE, auto detect its decode, and store in disk with UTF-16 LE
export function checkFileDecodeOrConvert(context: ExtensionContext, filePath: string, newFileName: string) {
    // detect decode
    let decode = detectFileDecode(filePath);
    let newFilePath = path.join(context.globalStorageUri.fsPath, newFileName);

    // convert decode
    if (!existsSync(context.globalStorageUri.fsPath)) {
        mkdirSync(context.globalStorageUri.fsPath);
    }
    if (decode !== "UTF-32 LE") {
        convertFileDecode(filePath, decode, newFilePath);
    } else {
        copyFileSync(filePath, newFilePath);
    }

    // store book list
    // context.globalState.update(bookLibraryKey, new Map<string, string>());
    let bookLibraryDictString = context.globalState.get(bookLibraryKey, "{}");
    let bookLibraryDict = JSON.parse(bookLibraryDictString);
    bookLibraryDict[newFileName] = newFilePath;
    context.globalState.update(bookLibraryKey, JSON.stringify(bookLibraryDict));

    window.showInformationMessage("添加成功");
}

function detectFileDecode(filePath: string): string {
    let decode = chardet.detectFileSync(filePath, { sampleSize: 128 });
    if (!decode) {
        throw new Error("当前编码不支持");
    }
    return decode.toString();
}

function convertFileDecode(oldfilePath: string, decode: string, newFilePath: string) {
    createReadStream(oldfilePath)
    .pipe(iconv.decodeStream(decode))
    .pipe(iconv.encodeStream("utf32-le"))
    .pipe(createWriteStream(newFilePath));
}

export function deleteFile(context: ExtensionContext, fileName: string) {
    let bookLibraryDictString = context.globalState.get(bookLibraryKey, "{}");
    let bookLibraryDict = JSON.parse(bookLibraryDictString);
    delete bookLibraryDict[fileName];
    context.globalState.update(bookLibraryKey, JSON.stringify(bookLibraryDict));

    let diskFilePath = path.join(context.globalStorageUri.fsPath, fileName);
    unlink(diskFilePath, err => {
        if (err) {
            window.showWarningMessage(err?.message);
        }
    });
}

export function downloadFileAndConvert(context: ExtensionContext, fileName: string, fileURL: string) {
    let tmpFilePath = path.join(context.globalStorageUri.fsPath, tmpFileName);
    (async () => {
        try {
            await pipeline(
                got.stream(fileURL),
                createWriteStream(tmpFilePath)
            );
            checkFileDecodeOrConvert(context, tmpFilePath, fileName);
        } catch(err) {
            window.showErrorMessage(`下载文件出错${err}`);
        }
    })();
}