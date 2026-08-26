import { renderClassic } from './classic.js';
import { renderModern } from './modern.js';
import { renderEditorial } from './editorial.js';

const RENDERERS = {
  classic: renderClassic,
  modern: renderModern,
  editorial: renderEditorial,
};

/**
 * @param {'classic'|'modern'|'editorial'} template
 * @param {object} data
 * @returns {string} HTML for Puppeteer's page.setContent()
 */
export function renderCertificateHtml(template, data) {
  const renderer = RENDERERS[template] ?? RENDERERS.classic;
  return renderer(data);
}
