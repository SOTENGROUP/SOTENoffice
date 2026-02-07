describe("/activity page", () => {
  it("loads without crashing", () => {
    cy.visit("/activity");
    // In secretless/unsigned state, UI should render the signed-out prompt.
    cy.contains(/sign in to view the feed/i).should("be.visible");
  });
});
