import { openSync, closeSync, readSync, fstatSync } from "fs";
import iconv = require('iconv-lite');
import { BookKind, BookStore } from  "./model";
import { Parser } from "./interface";

export class TxtFileParser implements Parser {
    private fd: number;
    private readonly stringMaxSize: number = 4;
    private readonly encoding: string = "utf32-le";
    private totalByteSize: number;
    private readedCount: number;
    private lastPageSize: number = 0;
    
    constructor (bookPath: string, readedCount: number) {
        this.fd = openSync(bookPath, 'r');
        this.totalByteSize = fstatSync(this.fd).size;
        this.readedCount = readedCount;
    }

    getPage(size: number, start: number): [string, number] {
        this.lastPageSize = size;
        let bufferSize = this.stringMaxSize * size;
        let buffer = Buffer.alloc(bufferSize);

        let readAllBytes = readSync(this.fd, buffer, 0, bufferSize, start);
        if (readAllBytes === 0) {
            return ["", 0];
        }

        let showText = iconv.decode(buffer, this.encoding);
        let lineBreakPosition = showText.indexOf('\n');
        if (lineBreakPosition !== -1) {
            bufferSize = ( lineBreakPosition + 1) * this.stringMaxSize;
            showText = showText.slice(0, lineBreakPosition);
        }
        
        showText = showText.replace(/\r/g, '').trim();
        return [showText, bufferSize];
    }

    async getNextPage(pageSize: number): Promise<string> {
        while (this.readedCount < this.totalByteSize) {
            let [showText, bufferSize] = this.getPage(pageSize, this.readedCount);
            this.readedCount += bufferSize;
            if (showText.length === 0) {
                continue;
            }
            return showText;
        }
        return '';
    }

    getPrevPage(pageSize: number): Promise<string> {
        this.readedCount -= pageSize * 2 * this.stringMaxSize;
        if (this.readedCount < 0) {
            this.readedCount = 0;
        }
        return this.getNextPage(pageSize);
    }

    close(): void {
        closeSync(this.fd);
    }

    getPercent(): string {
        return `${(this.readedCount / this.totalByteSize * 100).toFixed(2)}%`;
    }

    getPersistHistory(): BookStore {
        return {
            kind: BookKind.local,
            readedCount: this.readedCount - this.lastPageSize * this.stringMaxSize,
        };
    }

    // 新添加的获取书籍目录的方法
    async getBookDirectory(): Promise<string[]> {
        const pest = /(正文){0,1}(\s|\n)(第)([\u4e00-\u9fa5a-zA-Z0-9]{1,7})[章][^\n]{1,35}(\n|)/;
        const washpest = /(PS|ps)(.)*(\n)/;
        let directory: string[] = [];
        let start = 0;
        let bufferSize = 1024; // 每次读取的字节数，可以根据实际情况调整
        let buffer = Buffer.alloc(bufferSize);
        while (start < this.totalByteSize) {
            let readBytes = readSync(this.fd, buffer, 0, bufferSize, start);
            if (readBytes === 0) {
                break;
            }
            let text = iconv.decode(buffer.slice(0, readBytes), this.encoding);
            let matches = text.match(pest);
            if (matches) {
                directory.push(matches[0]);
            }
            // 应用替换规则，去除不需要的部分
            text = text.replace(washpest, '');
            start += readBytes;
        }
        return directory;
    }
}