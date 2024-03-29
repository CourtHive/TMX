describe('template spec', () => {
  it('passes', () => {
    cy.visit('http://localhost:5173');
    cy.get('#splash').click();
    cy.url().should('include', '/tournaments');
    cy.contains('Actions').click();
    cy.contains('Example tournaments').click();
    cy.visit('http://localhost:5173/#/tournament/tournament-id-02');
    cy.get('#e-route').click();
    cy.get('.tabulator-row-odd > [tabulator-field="event.eventName"]').click();
  });
});
