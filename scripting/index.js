const fs = require('fs');
const ynab = require('ynab');

const token = process.env.YNAB_TOKEN;
const budgetId = process.env.BUDGET_ID;

const ynabAPI = new ynab.API(token);

const $root = '__ROOT__';

(async () => {
  try {
    const { data: categoryData } = await ynabAPI.categories.getCategories(
      budgetId
    );

    const { category_groups } = categoryData;

    const { data: monthData } = await ynabAPI.months.getBudgetMonth(
      budgetId,
      'current'
    );

    const { month } = monthData;

    const rootNode = {
      id: $root,
      name: 'Income',
      value: month.budgeted,
      parent: null,
      children: []
    };

    const nodes = [rootNode];

    const categoryNodes = category_groups.reduce((acc, categoryGroup) => {
      if (categoryGroup.hidden || categoryGroup.deleted) return acc;

      let categoryGroupBudgeted = 0;

      const childNodes = categoryGroup.categories.reduce((acc, category) => {
        if (category.hidden || category.deleted || category.budgeted === 0)
          return acc;

        categoryGroupBudgeted += category.budgeted;

        acc.push({
          id: category.id,
          name: category.name,
          value: category.budgeted,
          parent: categoryGroup.id,
          children: null
        });

        return acc;
      }, []);

      // If nothing was budgeted in this categroup exclude it
      if (categoryGroupBudgeted === 0) return acc;

      const categoryGroupNode = {
        id: categoryGroup.id,
        name: categoryGroup.name,
        value: categoryGroupBudgeted,
        parent: $root,
        children: childNodes
      };

      rootNode.children.push(categoryGroupNode);

      acc.push(categoryGroupNode, ...childNodes);

      return acc;
    }, []);

    nodes.push(...categoryNodes);

    fs.writeFileSync('../src/data/nodes.json', JSON.stringify(nodes, null, 2));

    const lookup = nodes.reduce((acc, curr, idx) => {
      acc[curr.id] = idx;

      return acc;
    }, {});

    const links = [];

    for (let node of nodes) {
      if (node.children) {
        for (let child of node.children) {
          links.push({
            source: lookup[node.id],
            target: lookup[child.id],
            value: child.value
          });
        }
      }
    }

    fs.writeFileSync('../src/data/links.json', JSON.stringify(links, null, 2));
  } catch (err) {
    console.error('error: ', err);
  }
})();
