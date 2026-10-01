(function () {
  'use strict';

  var POSTS = [
    { slug: 'regalos-con-historia', title: 'Regalos con historia', category: 'Inspiración', date: '2026-08-18', excerpt: 'Una pieza artesanal guarda el gesto de quien la eligió y la historia de quien la recibe.', body: ['Elegir un regalo va más allá de encontrar un objeto bonito. Cuando una pieza está hecha a mano, cada detalle lleva tiempo, intención y una pequeña parte de la persona que la creó.', 'En Artesanías Gualeguay trabajamos con materiales seleccionados y diseños que pueden personalizarse para convertir una fecha especial en un recuerdo único.'] },
    { slug: 'como-cuidar-tu-pulsera', title: 'Cómo cuidar tu pulsera', category: 'Cuidados', date: '2026-08-04', excerpt: 'Pequeños hábitos que ayudan a conservar el brillo, la forma y la duración de tu pulsera.', body: ['Evitá el contacto permanente con perfumes, cremas y agua. Guardala separada de otras piezas para que no se raye y retirala antes de realizar actividades físicas.', 'Si notás desgaste, escribinos: muchas piezas pueden recibir mantenimiento y volver a lucir como nuevas.'] },
    { slug: 'souvenirs-que-representan', title: 'Souvenirs que representan', category: 'Colecciones', date: '2026-07-21', excerpt: 'Los recuerdos de una ciudad también pueden ser piezas únicas, cercanas y hechas con dedicación.', body: ['Un souvenir no tiene que ser igual para todos. Diseñamos piezas inspiradas en Gualeguay y en sus rincones para que cada visitante pueda llevarse algo auténtico.', 'Consultanos por cantidades especiales para eventos, empresas y celebraciones.'] },
    { slug: 'personalizacion-paso-a-paso', title: 'Personalización paso a paso', category: 'Proceso', date: '2026-07-08', excerpt: 'Conocé cómo elegimos colores, materiales y detalles para crear una pieza a tu medida.', body: ['Compartinos la idea, la ocasión y los colores que te representan. Luego te proponemos una versión, ajustamos los detalles y confirmamos el diseño antes de comenzar.', 'Cada pedido personalizado tiene su propio tiempo de elaboración y se despacha con instrucciones de cuidado.'] },
    { slug: 'materiales-con-alma', title: 'Materiales con alma', category: 'Taller', date: '2026-06-24', excerpt: 'Texturas, colores y pequeños detalles que hacen que cada pieza sea distinta.', body: ['Trabajamos con materiales livianos, resistentes y seleccionados para uso cotidiano. Las variaciones de textura y tono forman parte del valor de lo hecho a mano.', 'Conocé nuestras colecciones y descubrí la pieza que mejor cuenta tu historia.'] },
    { slug: 'regalos-para-toda-ocasion', title: 'Regalos para toda ocasión', category: 'Inspiración', date: '2026-06-10', excerpt: 'Ideas para cumpleaños, bodas, encuentros y momentos que merecen un detalle especial.', body: ['Un regalo artesanal puede adaptarse a la personalidad de cada persona. Te ayudamos a elegir una pieza significativa y a prepararla para sorprender.', 'Escribinos por WhatsApp y armamos una propuesta según tu presupuesto y ocasión.'] }
  ];

  function formatDate(value) {
    var date = new Date(value + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function postCard(post) {
    var card = document.createElement('article');
    card.className = 'blog-card';
    var meta = document.createElement('time');
    meta.dateTime = post.date;
    meta.textContent = formatDate(post.date);
    var title = document.createElement('h2');
    var link = document.createElement('a');
    link.href = 'blog-post.html?slug=' + encodeURIComponent(post.slug);
    link.textContent = post.title;
    title.appendChild(link);
    var excerpt = document.createElement('p');
    excerpt.textContent = post.excerpt;
    var actions = document.createElement('div');
    actions.className = 'blog-actions';
    var read = document.createElement('a');
    read.href = link.href;
    read.className = 'btn btn-outline btn-sm blog-read-more';
    read.textContent = 'Leer nota';
    actions.appendChild(read);
    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(excerpt);
    card.appendChild(actions);
    return card;
  }

  function renderList(options) {
    options = options || {};
    var container = document.getElementById('blogGrid');
    var empty = document.getElementById('blogEmpty');
    var pagination = document.getElementById('blogPagination');
    var query = (options.query || '').trim().toLowerCase();
    var category = options.category || '';
    var page = Math.max(1, Number(options.page) || 1);
    var perPage = Number(options.perPage) || 6;
    if (!container) return;
    var filtered = POSTS.filter(function (post) {
      var matchesQuery = !query || (post.title + ' ' + post.excerpt + ' ' + post.body.join(' ')).toLowerCase().includes(query);
      var matchesCategory = !category || post.category === category;
      return matchesQuery && matchesCategory;
    });
    var pages = Math.max(1, Math.ceil(filtered.length / perPage));
    var visible = filtered.slice((page - 1) * perPage, page * perPage);
    container.innerHTML = '';
    visible.forEach(function (post) { container.appendChild(postCard(post)); });
    if (empty) empty.style.display = visible.length ? 'none' : '';
    if (pagination) {
      window.renderPagination({ container: pagination, page: page, totalPages: pages, onChange: options.onChange });
    }
  }

  function initBlog() {
    var query = '';
    var category = '';
    var page = 1;
    var search = window.initSearchBar({
      container: document.getElementById('blogSearch'),
      debounce: 250,
      onSearch: function (value) { query = value; page = 1; renderList({ query: query, category: category, page: page, onChange: setPage }); }
    });
    var select = document.getElementById('blogCategory');
    if (select) select.addEventListener('change', function () { category = select.value; page = 1; renderList({ query: query, category: category, page: page, onChange: setPage }); });
    function setPage(next) { page = next; renderList({ query: query, category: category, page: page, onChange: setPage }); }
    window.initBreadcrumbs({ container: document.getElementById('blogBreadcrumbs'), items: [{ label: 'Inicio', href: '../index.html' }, { label: 'Blog' }] });
    renderList({ query: query, category: category, page: page, onChange: setPage });
    if (search && window.location.hash === '#search') {
      var input = document.getElementById('blogQuery');
      if (input) input.focus();
    }
  }

  function initBlogPost() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug') || '';
    var post = POSTS.find(function (item) { return item.slug === slug; });
    window.initBreadcrumbs({ container: document.getElementById('blogPostBreadcrumbs'), items: [{ label: 'Inicio', href: '../index.html' }, { label: 'Blog', href: 'blog.html' }, { label: post ? post.title : 'Nota no encontrada' }] });
    var root = document.getElementById('blogPostContent');
    if (!root) return;
    if (!post) {
      root.innerHTML = '';
      window.renderEmptyState({ container: root, icon: '⌕', title: 'Nota no encontrada', message: 'La nota que buscás no existe o fue movida.', action: { label: 'Volver al blog', href: 'blog.html', className: 'btn btn-primary btn-sm' } });
      return;
    }
    document.title = post.title + ' | Artesanías Gualeguay';
    var meta = document.createElement('time');
    meta.dateTime = post.date;
    meta.textContent = formatDate(post.date);
    var category = document.createElement('span');
    category.className = 'section-tag';
    category.textContent = post.category;
    var title = document.createElement('h1');
    title.className = 'section-title';
    title.textContent = post.title;
    var body = document.createElement('div');
    body.className = 'blog-article-body';
    post.body.forEach(function (paragraph) {
      var p = document.createElement('p');
      p.textContent = paragraph;
      body.appendChild(p);
    });
    var actions = document.createElement('div');
    actions.className = 'blog-actions';
    var back = document.createElement('a');
    back.href = 'blog.html';
    back.className = 'btn btn-outline';
    back.textContent = 'Volver al blog';
    actions.appendChild(back);
    root.appendChild(meta);
    root.appendChild(category);
    root.appendChild(title);
    root.appendChild(body);
    root.appendChild(actions);
  }

  window.initBlog = initBlog;
  window.initBlogPost = initBlogPost;
  window.blogPosts = POSTS;
}());
