import { workspace, ExtensionContext } from "vscode";
import { setStatusBarMsg } from "./util";
import { BookKind, BookStore } from "./parse/model";
import { Parser } from "./parse/interface";
import { TxtFileParser } from "./parse/txt";
import { CrawelerDomains } from "./const";
import { BiquWebParser } from "./parse/biqu";
import { CaimoWebParser } from "./parse/caimo";

let bookPath: string = "";
let parser: Parser;
const readEOFTip = "";


export function loadParser(context: ExtensionContext, bookPath: string): Parser {
  let store = context.globalState.get(bookPath, 0);

  let bookStore: BookStore;
  // compatible old version
  if (typeof store === "number") {
    bookStore = {
      kind: BookKind.local,
      readedCount: store,
    };
  } else {
    bookStore = store as BookStore;
  }

  switch (bookStore.kind) {
    case BookKind.local:
      return new TxtFileParser(bookPath, bookStore.readedCount);
    
    case BookKind.online:
      if(bookStore.sectionPath?.startsWith(<string>CrawelerDomains.get("biquURL"))) {
        return new BiquWebParser(<string>bookStore.sectionPath, bookStore.readedCount, bookPath);
      } else if(bookStore.sectionPath?.startsWith(<string>CrawelerDomains.get("caimoURL"))) {
        return new CaimoWebParser(<string>bookStore.sectionPath, bookStore.readedCount, bookPath);
      }
      throw new Error("book url is not supported");
    default:
      throw new Error("book kind is not supported");
  }
}

export async function readNextLine(context: ExtensionContext): Promise<string> {
  let pageSize: number = <number>workspace.getConfiguration().get("shadowReader.pageSize");
  let content = await parser.getNextPage(pageSize);
  if (content.length === 0) {
    return readEOFTip;
  }
  let percent = parser.getPercent();
  context.globalState.update(bookPath, parser.getPersistHistory());
  return `${content}   ${percent}`;
}

export async function readPrevLine(context: ExtensionContext): Promise<string> {
  let pageSize: number = <number>workspace.getConfiguration().get("shadowReader.pageSize");
  let content = await parser.getPrevPage(pageSize);
  let percent = parser.getPercent();
  context.globalState.update(bookPath, parser.getPersistHistory());
  return `${content}   ${percent}`;
}

export function closeAll(): void {
  if (parser) {
    parser.close();
  }
}

export function loadFile(context: ExtensionContext, newfilePath: string) {
  if (parser) {
    parser.close();
  }
  parser = loadParser(context, newfilePath);
  bookPath = newfilePath;
  let text = readNextLine(context).then(text => {
    setStatusBarMsg(text);
  });
}

export async function searchContentToEnd(context: ExtensionContext, keyword: string): Promise<string> {
  let keywordIndex = 0;
  let preLineEndMatch = false;
  let pageSize: number = <number>workspace.getConfiguration().get("shadowReader.pageSize");
  let accumulatedContent = "";
  let maxAccumulatedLength = 80; // 设置最大累积长度，可以根据实际情况调整
  let startIndex = 0; // 用于记录已处理内容的起始索引

  keyword = keyword.trim();

  while (true) {
    let content = await parser.getNextPage(pageSize);
    if (content.length === 0) {
      break;
    }
    accumulatedContent += content;

    // 当累积内容超过最大长度时，清除已处理过的部分内容
    if (accumulatedContent.length > maxAccumulatedLength) {
        accumulatedContent = accumulatedContent.slice(-maxAccumulatedLength);
        startIndex += accumulatedContent.length - maxAccumulatedLength; // 更新已处理内容的起始索引
    }
    // console.log('accumulatedContent ==>', accumulatedContent);

    for (let char of accumulatedContent) {
      if (char === keyword[keywordIndex]) {
        keywordIndex++;
        if (keywordIndex === keyword.length) {
          if (preLineEndMatch) {
            return await readPrevLine(context);
          } else {
            let percent = parser.getPercent();
            context.globalState.update(bookPath, parser.getPersistHistory());
            // 考虑 pageSize 的作用，截取最终展示的长度
            let finalContent = accumulatedContent.slice(startIndex); // 从起始索引开始截取
            if (finalContent.length > pageSize) {
                finalContent = finalContent.slice(0, pageSize); // 限制最终展示的长度
            }
            return `${finalContent}   ${percent}`;
          }
        }
      } else {
        keywordIndex = 0;
      }
    }

    // between two lines
    if (keywordIndex !== 0) {
      preLineEndMatch = true;
    }
  }
  return readEOFTip;
}
