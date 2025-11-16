import { Page } from '@playwright/test';
import { parse } from 'node-html-parser';

export class Mailbox {
  constructor(private readonly page: Page) {}

  async visitMailbox(
    email: string,
    params: {
      deleteAfter: boolean;
      filter?: 'recovery' | 'email' | RegExp;
    },
  ) {
    console.log(`Visiting mailbox ${email} ...`);

    const json = await this.getInviteEmail(email, params);

    if (!json?.HTML) {
      throw new Error('Email body was not found');
    }

    console.log('Email found');

    const html = json.HTML;
    const el = parse(html);

    // Try to pick the most relevant link based on filter
    let linkHref: string | undefined;
    const anchors = el.querySelectorAll('a');

    if (params.filter === 'recovery') {
      linkHref = anchors.find((a) => a.getAttribute('href')?.includes('type=recovery'))?.getAttribute('href');
    }

    if (!linkHref && params.filter === 'email') {
      linkHref = anchors.find((a) => a.getAttribute('href')?.includes('type=email'))?.getAttribute('href');
    }

    if (!linkHref && params.filter instanceof RegExp) {
      linkHref = anchors.find((a) => {
        const href = a.getAttribute('href') ?? '';
        return params.filter!.test(href);
      })?.getAttribute('href');
    }

    // Fallback to the first link in the email
    if (!linkHref) {
      linkHref = el.querySelector('a')?.getAttribute('href') ?? undefined;
    }

    if (!linkHref) {
      throw new Error('No link found in email');
    }

    console.log(`Visiting ${linkHref} from mailbox ${email}...`);

    return this.page.goto(linkHref);
  }

  async getInviteEmail(
    email: string,
    params: {
      deleteAfter: boolean;
      filter?: 'recovery' | 'email' | RegExp;
    },
  ) {
    const url = `http://127.0.0.1:54324/api/v1/search?query=to:${encodeURIComponent(email)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }

    const json = (await response.json()) as { messages: Array<{ ID: string }> };

    if (!json?.messages || !json.messages.length) {
      return;
    }

    // Iterate messages from newest to oldest to find the right one
    const messages = json.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
      const mid = messages[i]?.ID;
      if (!mid) continue;

      const murl = `http://127.0.0.1:54324/api/v1/message/${mid}`;
      const mres = await fetch(murl);
      if (!mres.ok) {
        continue;
      }
      const mjson = await mres.json();

      const html: string | undefined = mjson?.HTML;
      const headers: Record<string, any> | undefined = mjson?.Headers;

      // Apply filter if present
      let matches = true;
      if (params.filter === 'recovery') {
        matches = typeof html === 'string' && html.includes('type=recovery');
      } else if (params.filter === 'email') {
        matches = typeof html === 'string' && html.includes('type=email');
      } else if (params.filter instanceof RegExp) {
        matches = typeof html === 'string' && params.filter.test(html);
      }

      if (matches) {
        // Optionally delete the message we used
        if (params.deleteAfter) {
          console.log(`Deleting email ${mid} ...`);
          const del = await fetch(murl, { method: 'DELETE' });
          if (!del.ok) {
            console.error(`Failed to delete email: ${del.statusText}`);
          }
        }
        return mjson;
      }
    }

    return undefined;
  }
}
