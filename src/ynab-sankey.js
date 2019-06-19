import * as ynab from 'ynab';

class Client {
  constructor(token) {
    if (!token) throw new Error('must provide a ynab token');
    this.token = token;
    this.ynabAPI = new ynab.API(token);
    this._sankey = null;
  }

  getSankeyForBudgetMonth = async (budgetId, month = 'current') => {
    if (!budgetId) {
      throw new Error('must provide a budgetId');
    }

    try {
      const {
        data: categoryData
      } = await this.ynabAPI.categories.getCategories(budgetId);

      const { category_groups } = categoryData;

      const { data: monthData } = await this.ynabAPI.months.getBudgetMonth(
        budgetId,
        month
      );

      this._sankey = new YNABSankey(category_groups, monthData.month);

      return { nodes: this._sankey.getNodes(), links: this._sankey.getLinks() };
    } catch (error) {
      throw new Error(`error creating YNABSankey: ${error}`);
    }
  };
}

class YNABSankey {
  constructor(categoryGroups, month = 'currnet') {
    this.root = {
      id: '__ROOT__',
      name: 'Budgeted Income',
      value: month.budgeted,
      children: []
    };
    this._nodeCache = [];
    this._linksCache = [];

    categoryGroups.forEach(this._insertCategoryGroupNode);
  }

  _insertCategoryGroupNode = categoryGroup => {
    if (categoryGroup.hidden || categoryGroup.deleted) return;

    let categoryGroupBudgeted = 0;

    const categoryNodes = categoryGroup.categories.reduce((acc, category) => {
      if (category.hidden || category.deleted || category.budgeted === 0)
        return acc;

      categoryGroupBudgeted += category.budgeted;

      acc.push({
        id: category.id,
        name: category.name,
        value: category.budgeted,
        children: []
      });

      return acc;
    }, []);

    if (categoryGroupBudgeted === 0) return;

    const node = {
      id: categoryGroup.id,
      name: categoryGroup.name,
      value: categoryGroupBudgeted,
      children: categoryNodes
    };

    this.root.children.push(node);
  };

  getNodes = () => {
    if (this._nodeCache.length > 0) return this._nodeCache;

    const _getNodes = (node, nodes = []) => {
      nodes.push(node);

      for (let child of node.children) {
        _getNodes(child, nodes);
      }

      return nodes;
    };

    this._nodeCache = _getNodes(this.root);
    return [...this._nodeCache];
  };

  getLinks = () => {
    if (this._linksCache.length > 0) return this._linksCache;

    if (this._nodeCache.length === 0) {
      this.getNodes();
    }

    const indexLookup = this._nodeCache.reduce((lookup, node, idx) => {
      lookup[node.id] = idx;

      return lookup;
    }, {});

    const _getLinks = (node, links = []) => {
      for (let child of node.children) {
        if (child.children.length > 0) {
          _getLinks(child, links);
        }

        links.push({
          source: indexLookup[node.id],
          target: indexLookup[child.id],
          value: child.value
        });
      }

      return links;
    };

    this._linksCache = _getLinks(this.root);

    return [...this._linksCache];
  };
}

export default Client;
