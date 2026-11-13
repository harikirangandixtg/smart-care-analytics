import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** "Questions this screen answers": each row opens AI Analytics with the question pre-filled and sent. */
@Component({
  selector: 'app-question-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th scope="col">Question</th><th scope="col">Shown as</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
        <tbody>
          @for (r of rows(); track r.question) {
            <tr>
              <td>“{{ r.question }}”</td>
              <td><span class="pill pill-blue">{{ r.shownAs }}</span></td>
              <td class="num"><a class="strong" [routerLink]="['/ai-analytics']" [queryParams]="{ q: r.question }">Ask this</a></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class QuestionListComponent {
  readonly rows = input.required<{ question: string; shownAs: string }[]>();
}
